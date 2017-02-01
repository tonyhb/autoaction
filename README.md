## AutoAction automatically calls redux actions on mount and prop changes

----

**For data loading this is deprecated in favour of: https://github.com/tonyhb/tectonic**

----

Automatically call redux actions from state.

### Setup:

1. Put `@autoaction` **beneath** `@connect` so it receives new props from Redux
2. Pass an object to the `@autoaction` decorator where:
  i. array keys are action names
  ii. array values are functions that accept params and state, and return array
  arguments

### How it works

1. autoaction accepts a map of action-names to a function which returns action
   arguments.
2. if any arguments resolve to undefined we **don't call that action**. This
   allows actions to update redux state, which then triggers other actions
3. if actions are called multiple times with the same arguments **dedupe and
   only call these once**. This allows child components in a tree to request 
   data that any parents request with ony one request to thee API.

Examples:

```js
// Single argument:
//
// Automatically call getPost with state.router.params.slug, ie:
// getPost(state.router.params.slug)
@autoaction({
  getPost: (params, state) => state.router.params.slug
}, postActions)

// Multiple arguments:
// getPost(params.id, state.router.params.slug)
@autoaction({
  getPost: (params, state) => [params.id, state.router.params.slug]
}, postActions)

// Multiple arguments as object:
// getPost({ id: params.id, slug: state.router.params.slug })
@autoaction({
  getPost: (params, state) => {
    return: {
      id: params.id,
      slug: state.router.params.slug
    };
  }
}, postActions)

// Call an action each time a state/prop value changes but **isn't an action
// argument**
@autoaction({
  // postActions.resetUI will be called with 'post' as the argument each time
  // the 'key' updates (ie. state.router.params.slug changes)
  resetUI: {
    args: 'post',
    key: (params, state) => state.router.params.slug
  },
}, postActions)
```

**And exactly how?**

We connect to redux state directly and listen to store changes.  We enqueue
action calls in `componentWillMount` for all components and dispatch them in
`componentDidMount`. This allows us to dedupe any action calls from children,
allowing all components to request the same actions if need be.

When we receive new props we enqueue actions and dispatch immediately. To
prevent stack overflows we delete actions from the queue before dispatching.

### API



### Basic example

Action:

```js
// Note that this function accepts an object and immediately destructures into
// arguments. It is called via getPostBySlug({ slug: 'some-post' });
export function getPostBySlug({ slug }) {
  return {
    type: "GET_POST",
    meta: {
      promise: Axios.get(`/api/posts/${slug}`)
    }
  };
}
```

Component:

```js
import autoaction from 'autoaction';
import * as postActions from 'actions/posts';
import { createStructuredSelector } from 'reselect';

const mapState = createStructuredSelector({
  post: (state) => state.post,
  comments: (state) => state.comments[state.post]
});

// In this example, getPostBySlug will be called from redux-router state
// immediately.  `params.post.id` returns undefined and so
// `getCommentsbyPostId` won't be called immediately.
// When getPostBySlug resolves the component will receive post props and will
// call getCommentsByPostID automatically.
@connect(mapState)
@autoaction({
  getPostBySlug: (params, state) => { return { slug: state.router.params.slug }; }
  getCommentsByPostID: (params, state) => params.post.id
}, postActions)
class BlogPost extends Component {
  static propTypes = {
    post: PropTypes.object
  }

  render() {
    return (
      <h1>postActions.getPostBySlug was automatically called with the slug
        router parameter!</h1>
    );
  }
}
```
