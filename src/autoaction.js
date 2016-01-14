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
        const isUnique = uniq.every(prev => {
          // Only test keys if the current call has a key and it doesn't match
          // the previous key.
          const isKeyMatch = (call.key !== null && prev.key === call.key);
          const isArgMatch = deepEqual(prev.args, call.args);

          // If both the action args and keys match this is non-unique, so
          // return false.
          return !(isKeyMatch === true && isArgMatch === true);
        });

        if (isUnique) {
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
      const data = autoActions[action];

      if (Array.isArray(data)) {
        computed[action] = {
          args: data,
          key: null
        };
        return computed;
      }

      // we may have an arg function or an object containing arg and key
      // functions.
      switch (typeof data) {
        case 'function': 
          computed[action] = {
            args: data(props, state),
            key: null
          };
          break;
        case 'object':
        let args = data.args
          // If we're passed a function which calcs args based on props/state,
          // call it. Otherwise assume that data.args is a single type to be
          // used as the argument itsekf
          if (typeof data === 'function') {
            args = args(props, state);
          }
          computed[action] = {
            args,
            key: data.key(props, state)
          };
          break;
        default:
          // By default use this as the argument
          computed[action] = {
            args: data,
            key: null
          };
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

      // When the Redux store recevies new state this is called immediately (via
      // trySubscribe).
      //
      // Each action called via autoaction can use props to determine arguments
      // for the action.
      //
      // Unfortunately, we're listening to the store directly.  This means that
      // `handleStoreChange` may be called before any parent components receive
      // new props and pass new props to our autoaction component.  That is
      // - the parent component hasn't yet received the store update event and
      // the passed props are out-of-sync with actual store state (they're
      // stale).
      //
      // By computing actions within a requestAnimationFrame window we can
      // guarantee that components have been repainted and any parent @connect
      // calls have received new props.  This means that our props used as
      // arguments within autoconnect will always be in sync with store state.
      //
      // This is kinda complex.  Trust us, this works.
      //
      // TODO: Write test case.
      handleStoreChange() {
        const handleChange = () => {
          const actions = computeAllActions(this.props, this.store.getState());
          if (deepEqual(actions, this.mappedActions)) {
            return;
          }

          this.tryCreators(actions);
          BatchActions.tryDispatch();
        };

        // See above comments for explanation on using RAF.
        if (window && window.requestAnimationFrame) {
          window.requestAnimationFrame(handleChange);
        } else {
          handleChange();
        }
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
