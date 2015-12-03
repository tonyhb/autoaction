# v0.0.5

- Fix bug when deleting items from a queue rendering calls as undefined
- Add better documentation to readme

# v0.0.4

- Prevent stack overflows when listening to props with undefined arguments

# v0.0.3

- Call actions using `.apply` if we have an array of arguments

# v0.0.2

- Allow all props to call actions automatically.  This lets us call actions
  from state (eg. router params), then automatically request data based on the
  initial action call.
