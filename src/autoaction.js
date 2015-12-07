'use strict';

// import storeShape from 'react-redux/lib/utils/storeShape';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';
import React, { PropTypes } from 'react';
import deepEqual from 'deep-equal';
import { bindActionCreators } from 'redux';

const BatchActions = {
  isDispatching: false,

  // Needs:
  //   - action name
  //   - arguments
  //   - function wrapped with dispatcher

  // object in the format of:
  //   {
  //     actionName: [
  //       {func, args, key},
  //       {func, args, key},
  //     ],
  //   }
  queue: {
  },

  called: {},

  // tryDispatch iterates through all queued actions and dispatches actions
  // with unique arguments.
  //
  // Each dispatch changes store state; our wrapper component listens to store
  // changes and queues/dispatches more actions.  This means that we need to
  // remove actions from our queue just before they're dispatched to prevent
  // stack overflows.
  tryDispatch() {
    Object.keys(this.queue).forEach( actionName => {
      let calls = this.queue[actionName] || [];

      // Iterate through all of this action's batched calls and dedupe
      // if arguments are the same
      calls = calls.reduce((uniq, call, idx) => {
        // if the args and key arent the same this is a new unique call
        if (uniq.every(el => (!deepEqual(el.args, call.args) && el.key !== call.key))) {
          uniq.push(call);
        }
        // Remove this from our queue.
        this.queue[actionName].splice(idx, 1);
        return uniq;
      }, []);

      // call each deduped action and pass in the required args
      calls.forEach((call, idx) => {
        if (Array.isArray(call.args)) {
          return call.func.apply(null, call.args);
        }
        // this is either an object or single argument; call as expected
        return call.func(call.args);
      });
    });

    this.queue = {};
  },

  enqueue(actionName, func, args, key) {
    let actions = this.queue[actionName] || [];
    actions.push({
      args,
      func,
      key
    });
    this.queue[actionName] = actions;
  }
};

/**
 * autoaction is an ES7 decorator which wraps a component with declarative
 * action calls.
 *
 * The actions map must be in the format of { actionName: stateFunc }
 *
 * Example usage:
 *
 *   @autoaction({
 *     getBlogPost: (state) => { return { org: state.params.router.slug }; }
 *   })
 *   @connect(mapState)
 *   class Post extends React.Component {
 *
 *     static propTypes = {
 *       post: React.PropTypes.object.isRequired
 *     }
 *
 *     render() {
 *       ...
 *     }
 *
 *   }
 *
 */
export default function autoaction(autoActions = {}, actionCreators = {}) {
  // Overall goal:
  // 1. connect to the redux store
  // 2. subscribe to data changes
  // 3. compute arguments for each action call
  // 4. if any arguments are different call that action bound to the dispatcher

  // We refer to this many times throughout this function
  const actionNames = Object.keys(autoActions);

  // If we're calling actions which have no functions to prepare arguments we
  // don't need to subscribe to store changes, as there is nothing from the
  // store that we need to process.
  const shouldSubscribe = actionNames.length > 0 &&
    actionNames.some(k => typeof autoActions[k] === 'function');

  // Given a redux store and a list of actions to state maps, compute all
  // arguments for each action using autoActions passed into the decorator and
  // return a map contianing the action args and any keys for invalidation.
  function computeAllActions(props, state) {
    return actionNames.reduce((computed, action) => {
      // we may have an arg function or an object containing arg and key
      // functions.
      switch (typeof autoActions[action]) {
        case 'function': 
          computed[action] = {
            args: autoActions[action](props, state),
            key: null
          };
          break;
        case 'object':
          computed[action] = {
            args: autoActions[action].args(props, state),
            key: autoActions[action].key(props, state)
          };
          break;
        default:
          // TODO: invariant
      }
      return computed;
    }, {});
  }

  // If any argument within any action call is undefined our arguments should be
  // considered invalid and this should return true.
  function areActionArgsInvalid(args) {
    // single argument actions
    if (args === undefined) {
      return true;
    }
    if (Array.isArray(args)) {
      return args.some(arg => arg === undefined);
    }
    if (typeof args === 'object') {
      return Object.keys(args).some(arg => args[arg] === undefined);
    }
    // TODO: throw an invariant here
    return false;
  }

  return (WrappedComponent) => {

    /**
     * Autoconect is a wrapper component that:
     *   1. Resolves action arguments via selectors from global state
     *   2. Automatically calls redux actions with the determined args
     *
     * This lets us declaratively call actions from any component, which in short:
     *   1. Allows us to declaratively load data
     *   2. Reduces boilerplate for loading data across componentWillMount and
     *      componentWillReceiveProps
     */
    return class autoaction extends React.Component {

      static contextTypes = {
        store: React.PropTypes.any
      }

      constructor(props, context) {
        super(props, context);

        this.store = context.store;
        this.mappedActions = computeAllActions(props, this.store.getState());
        this.actionCreators = bindActionCreators(actionCreators, this.store.dispatch)
      }

      componentWillMount() {
        this.tryCreators();
      }

      componentDidMount() {
        this.trySubscribe();
        BatchActions.tryDispatch();
      }

      componentWillUnmount() {
        this.tryUnsubscribe();
      }

      trySubscribe() {
        if (shouldSubscribe && !this.unsubscribe) {
          this.unsubscribe = this.store.subscribe(::this.handleStoreChange);
        }
      }

      tryUnsubscribe() {
        if (typeof this.unsubscribe === 'function') {
          this.unsubscribe();
          this.unsubscribe = null;
        }
      }

      handleStoreChange() {
        const actions = computeAllActions(this.props, this.store.getState());
        if (deepEqual(actions, this.mappedActions)) {
          return;
        }

        this.tryCreators(actions);
        BatchActions.tryDispatch();
      }

      // Iterate through all actions with their computed arguments and call them
      // if necessary.
      // We only call the action if all arguments !== undefined and:
      //   - this is the first time calling tryCreators, or
      //   - the arguments to the action have changed
      tryCreators(actions = this.mappedActions) {
        // If we're calling tryCreators with this.mappedActions we've never
        // called the actions before.
        const initialActions = (actions === this.mappedActions);

        Object.keys(actions).forEach(a => {
          let action = actions[a];

          if (areActionArgsInvalid(action.args)) {
            // TODO: LOG
            return;
          }

          if (initialActions || !deepEqual(action, this.mappedActions[a])) {
            this.mappedActions[a] = action;
            BatchActions.enqueue(a, this.actionCreators[a], action.args, action.key);
          }
        });
      }

      shouldComponentUpdate(nextProps, nextState) {
        return !shallowEqual(nextProps, this.props);
      }

      render() {
        return (
          <WrappedComponent { ...this.props } />
        );
      }
    }
  };

}
