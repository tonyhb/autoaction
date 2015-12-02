/*eslint-disable */

// import storeShape from 'react-redux/lib/utils/storeShape';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';
import React, { PropTypes } from 'react';
import deepEqual from 'deep-equal';
import { bindActionCreators } from 'redux';

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
  // arguments for each action.
  function computeAllActionArgs(store) {
    const state = store.getState();

    return actionNames.reduce((computed, action) => {
      computed[action] = autoActions[action](state);
      return computed;
    }, {});
  }

  // If any argument within any action call is undefined our arguments should be
  // considered invalid and this should return true.
  function areActionArgsInvalid(action) {
    return Object.keys(action).some(arg => action[arg] === undefined);
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
        this.mappedActions = computeAllActionArgs(this.store);
        this.actionCreators = bindActionCreators(actionCreators, this.store.dispatch)
      }

      componentWillMount() {
        this.tryCreators();
      }

      componentDidMount() {
        this.trySubscribe();
        this.tryCreators();
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
        const actions = computeAllActionArgs(this.store);
        if (deepEqual(actions, this.mappedActions)) {
          return;
        }

        this.tryCreators(actions);
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
          let actionArgs = actions[a];

          if (areActionArgsInvalid(actionArgs)) {
            // TODO: LOG
            return;
          }

          if (initialActions || !deepEqual(actionArgs, this.mappedActions[a])) {
            this.actionCreators[a](actionArgs);
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
