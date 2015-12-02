# AutoAction makes data loading declarative

Automatically call redux actions from state.

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
  post: (state) => state.post
});

@autoaction({
  getPostBySlug: (state) => { return { slug: state.router.params.slug }; }
}, postActions)
@connect(mapState)
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
