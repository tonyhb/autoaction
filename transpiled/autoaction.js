'use strict';

// import storeShape from 'react-redux/lib/utils/storeShape';
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x4, _x5, _x6) { var _again = true; _function: while (_again) { var object = _x4, property = _x5, receiver = _x6; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x4 = parent; _x5 = property; _x6 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

exports['default'] = autoaction;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _reactReduxLibUtilsShallowEqual = require('react-redux/lib/utils/shallowEqual');

var _reactReduxLibUtilsShallowEqual2 = _interopRequireDefault(_reactReduxLibUtilsShallowEqual);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _deepEqual = require('deep-equal');

var _deepEqual2 = _interopRequireDefault(_deepEqual);

var _redux = require('redux');

var BatchActions = {
  isDispatching: false,

  // Needs:
  //   - action name
  //   - arguments
  //   - function wrapped with dispatcher

  // object in the format of:
  //   {
  //     actionName: [
  //       {args, func},
  //       {args, func},
  //     ],
  //   }
  queue: {},

  called: {},

  tryDispatch: function tryDispatch() {
    var _this = this;

    Object.keys(this.queue).forEach(function (actionName) {
      var calls = _this.queue[actionName];

      // Iterate through all of this action's batched calls and dedupe
      // if arguments are the same
      calls = calls.reduce(function (uniq, call) {
        if (uniq.every(function (el) {
          return !(0, _deepEqual2['default'])(el.args, call.args);
        })) {
          uniq.push(call);
        }
        return uniq;
      }, []);

      // Call each action
      calls.forEach(function (call) {
        call.func(call.args);
      });
    });

    this.queue = {};
  },

  enqueue: function enqueue(actionName, args, func) {
    var actions = this.queue[actionName] || [];
    actions.push({
      args: args,
      func: func
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

function autoaction() {
  var autoActions = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var actionCreators = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  // Overall goal:
  // 1. connect to the redux store
  // 2. subscribe to data changes
  // 3. compute arguments for each action call
  // 4. if any arguments are different call that action bound to the dispatcher

  // We refer to this many times throughout this function
  var actionNames = Object.keys(autoActions);

  // If we're calling actions which have no functions to prepare arguments we
  // don't need to subscribe to store changes, as there is nothing from the
  // store that we need to process.
  var shouldSubscribe = actionNames.length > 0 && actionNames.some(function (k) {
    return typeof autoActions[k] === 'function';
  });

  // Given a redux store and a list of actions to state maps, compute all
  // arguments for each action.
  function computeAllActionArgs(props, state) {
    return actionNames.reduce(function (computed, action) {
      computed[action] = autoActions[action](props, state);
      return computed;
    }, {});
  }

  // If any argument within any action call is undefined our arguments should be
  // considered invalid and this should return true.
  function areActionArgsInvalid(action) {
    return Object.keys(action).some(function (arg) {
      return action[arg] === undefined;
    });
  }

  return function (WrappedComponent) {

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
    return (function (_React$Component) {
      _inherits(autoaction, _React$Component);

      _createClass(autoaction, null, [{
        key: 'contextTypes',
        value: {
          store: _react2['default'].PropTypes.any
        },
        enumerable: true
      }]);

      function autoaction(props, context) {
        _classCallCheck(this, autoaction);

        _get(Object.getPrototypeOf(autoaction.prototype), 'constructor', this).call(this, props, context);

        this.store = context.store;
        this.mappedActions = computeAllActionArgs(props, this.store.getState());
        this.actionCreators = (0, _redux.bindActionCreators)(actionCreators, this.store.dispatch);
      }

      _createClass(autoaction, [{
        key: 'componentWillMount',
        value: function componentWillMount() {
          this.tryCreators();
        }
      }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
          this.trySubscribe();
          BatchActions.tryDispatch();
        }
      }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
          this.tryUnsubscribe();
        }
      }, {
        key: 'trySubscribe',
        value: function trySubscribe() {
          if (shouldSubscribe && !this.unsubscribe) {
            this.unsubscribe = this.store.subscribe(this.handleStoreChange.bind(this));
          }
        }
      }, {
        key: 'tryUnsubscribe',
        value: function tryUnsubscribe() {
          if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
          }
        }
      }, {
        key: 'handleStoreChange',
        value: function handleStoreChange() {
          var actions = computeAllActionArgs(this.props, this.store.getState());
          if ((0, _deepEqual2['default'])(actions, this.mappedActions)) {
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
      }, {
        key: 'tryCreators',
        value: function tryCreators() {
          var _this2 = this;

          var actions = arguments.length <= 0 || arguments[0] === undefined ? this.mappedActions : arguments[0];

          // If we're calling tryCreators with this.mappedActions we've never
          // called the actions before.
          var initialActions = actions === this.mappedActions;

          Object.keys(actions).forEach(function (a) {
            var actionArgs = actions[a];

            if (areActionArgsInvalid(actionArgs)) {
              // TODO: LOG
              return;
            }

            if (initialActions || !(0, _deepEqual2['default'])(actionArgs, _this2.mappedActions[a])) {
              _this2.mappedActions[a] = actionArgs;
              BatchActions.enqueue(a, actionArgs, _this2.actionCreators[a]);
            }
          });
        }
      }, {
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate(nextProps, nextState) {
          return !(0, _reactReduxLibUtilsShallowEqual2['default'])(nextProps, this.props);
        }
      }, {
        key: 'render',
        value: function render() {
          return _react2['default'].createElement(WrappedComponent, this.props);
        }
      }]);

      return autoaction;
    })(_react2['default'].Component);
  };
}

module.exports = exports['default'];