# redux-fetch

Yet another [redux middleware](https://redux.js.org/docs/advanced/Middleware.html) to perform HTTP requests.

## Introduction

This library is at a very early stage of development and will eventually be published on npmjs some day.
Any ideas, [issue reports](https://github.com/nilscox/redux-fetch/issues),
[pull requests](https://github.com/nilscox/redux-fetch/pulls) or contributions of any kind are welcome.

_redux-fetch_ attempts to provide a simple, yet complete API to perform HTTP calls easily with [redux](https://redux.js.org).

The philosophy remains quite simple: you can dispatch an action describing a call to an HTTP server,
such as a `new FetchAction('FETCH_DATA')`, and the middleware will dispatch several
[redux actions](https://redux.js.org/basics/actions) with types:

- `FETCH_DATA_REQUEST`: right before the request starts
- `FETCH_DATA_SUCCESS`: after the request finished, if everything went fine
- `FETCH_DATA_FAILURE`: after the request finished, if someting went wrong
- `FETCH_DATA_FINISH`: after the request finished

## Installation

As this package is not published on npmjs yet, it can only be installed from this github repository:

```
yarn add nilscox/redux-fetch
```

## Usage

```js
import { createStore, applyMiddleware } from 'redux';
import { createFetchMiddleware, FetchAction } from 'reduxFetch';
import reducer from 'somewhere';

const fetchMiddleware = createFetchMiddleware({
  baseUrl: 'http://some.api',
});

const store = createStore(reducer, applyMiddleware(fetchMiddleware));

const action = new FetchAction('USER_LOGIN')
  .post('/user/login')
  .body({ email: 'im@not.evil', password: 'TRU$T_M3' });

store.dispatch(action);
```

Assuming the call to `http://some.api/user/login` with the provided credentials works as expected, this code will dispatch 3 actions:

```
{
  type: 'USER_LOGIN_REQUEST',
  url: 'http://some.api/user/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    email: 'im@not.evil',
    password: 'TRU$T_M3',
  },
}
```

```
{
  type: 'USER_LOGIN_SUCCESS',
  status: 200,
  duration: 421,
  body: {
    id: 1337,
    email: 'im@not.evil',
    token: 'some-token',
  },
}
```

```
{
  type: 'USER_LOGIN_FINISH',
  duration: 421,
}
```

## API documentation

### Actions

When a FetchAction is dispatched, 4 kinds of "regular" redux actions can be handled by the reducer. Here are their type definitions,
with `<PREFIX>` being the string given to the `FetchAction`'s contructor.

#### Request action:

```
{
  type: '<PREFIX>_REQUEST',
  url: string,
  body: string | Object,
  ...options,
}
```

If no body is set, then it will not appear in the action.
The options that will be given as the second parameter of `fetch` are spread in the action.

#### Success action:

```
{
  type: '<PREFIX>_SUCCESS',
  status: number,
  duration: number,
  body: string | Object,
}
```

The duration is in miliseconds.
If no body is returned in the response (e.g. if status is `204`), then the `body` will not appear in the action.

#### Failure action:

See [Success action](#success-action). Only the `_SUCCESS` is replaced with `_FAILURE`.

#### Finish action:

```
{
  type: '<PREFIX>_FINISH',
  duration: number,
}
```

The duration is in milliseconds.

### FetchAction

The `FetchAction` class intends to represent a call to a HTTP server. A `prefix` must be provided when instanciating a new `FetchAction`
in order to generate the types of the resulting request, success, failure and finish actions. Appart from the prefix, any other
configuration is optional. Every method of the `FetchAction` class returns the class instance in order to be chained, like real js
developers like to do.

Here is a list of all the methods that can be called to configure a `FetchAction`:

- [HTTP_METHOD(route)](#http_methodroute)
- [body(obj)](#bodyobj)
- [header(key, value)](#headerkey-value)
- [opts(obj)](#optsobj)
- [expect(values)](#expectvalues)
- [onRequest(callback)](#onrequestcallback)
- [onSuccess(callback)](#onsuccesscallback)
- [onFailure(callback)](#onfailurecallback)
- [onFinish(callback)](#onfinishcallback)

#### HTTP_METHOD(route)

Configure the method and the route that will be used. Obviously, `HTTP_METHOD` should be replaced with the appropriate method, in lower case.
The route is appened to the base url given to the middleware configuration, if any (and if not, the full url can be provided instead of the route).

#### body(obj)

Set the body that will be sent with the request. If `obj` is an objet, it will be stringified and the request's `Content-Type` header will be
set to `application/json`. In other cases, the request's `Content-Type` will be set to `text/plain`.
Maybe something smarter can be done here, let me know if you think of something else.

#### header(key, value)

Set a HTTP header field that will be sent with the request. This can be used to override the `Content-Type` set by a call to [body](#bodyobj).

#### opts(obj)

Add custom options to the call to fetch. The object will be merged with already defined options.

#### expect(values)

Set the expected status code(s). `values` can be either an integer or an array of integers.

When the request has finished, a _success_ action will be triggered if the actual request status code is within the expected values. In the same way,
a _failure_ actionwill be triggered instead if the status code does not appear in the expected values.

If no expeceted values are set, the type of event that is dispatched is based on [`res.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok).

#### onRequest(callback)

Provide a callback to be invoked before the request starts. Its signature is:

```
(dispatch, getState, url, opts, body) -> boolean
```

- dispatch: Redux's disptach function
- getState: Redux's getState function
- url: The requested url (eventually prefixed with baseUrl)
- opts: The options passed to fetch
- body (optional): The request body

If the callback returns false, the `<PREFIX>_REQUEST` action will not be dispatched.

#### onSuccess(callback)

Provide a callback to be invoked when the request succeeded. Its signature is:

```
(dispatch, getState, status, body, duration) -> boolean
```

- dispatch: Redux's disptach function
- getState: Redux's getState function
- status: The response status code
- body: The response body
- duration: The time that the request took (ms)

If the callback returns false, the `<PREFIX>_SUCCESS` action will not be dispatched.

#### onFailure(callback)

Provide a callback to be invoked when the request failed. Its signature is:

```
(dispatch, getState, status, body, duration) -> boolean
```

- dispatch: Redux's disptach function
- getState: Redux's getState function
- status: The response status code
- body: The response body
- duration: The time that the request took (ms)

If the callback returns false, the `<PREFIX>_FAILURE` action will not be dispatched.

#### onFinish(callback)

Provide a callback to be invoked when the request has terminated. Its signature is:

```
(dispatch, getState, duration) -> boolean
```

- dispatch: Redux's disptach function
- getState: Redux's getState function
- duration: The time that the request took (ms)

If the callback returns false, the `<PREFIX>_FINISH` action will not be dispatched.

### Configuration

The middleware can be configured with several options given as an objet to the `createFetchMiddleware` function.
All configuration values are optional.

```
config = {
  fetch: [Function](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch),
  baseUrl: string,
  onRequest: Function,
  onSuccess: Function,
  onFailure: Function,
  onFinish: Function,
}
```

- fetch: Custom fetch implementation or wrapper around fetch.
- baseUrl: The base URL that will be prefixed to any request's route.
- suffixes: An objet defining the suffixes to be used in the action types.
- onRequest: A callback function that will be invoked before any request (see [FetchAction.onRequest](#onrequestcallback))
- onSuccess: A callback function that will be invoked after a request succeeded (see [FetchAction.onSuccess](#onsuccesscallback))
- onFailure: A callback function that will be invoked after a request failed (see [FetchAction.onFailure](#onfailurecallback))
- onFinish: A callback function that will be invoked after any request (see [FetchAction.onFinish](#onfinishcallback))

> The `FetchAction` callback takes precedence over the one defined in the configuration if both are defined.

### Dispatch return

A call to dispatch with a `FetchAction` returns a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
that resolves an objet of type:

```
{
  response: [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response),
  duration: number,
  body: any,
}
```

- result: The response resolved by the call to fetch
- duration: The time that took the request (ms)
- body: The response payload

### createFetchActionTypes(prefix)

A helper function to define the four action types with the default suffixes.

```
console.log(createFetchActionTypes('LOAD_DATA'));

/*
{
  REQUEST: 'LOAD_DATA_REQUEST',
  SUCCESS: 'LOAD_DATA_SUCCESS',
  FAILURE: 'LOAD_DATA_FAILURE',
  FINISH: 'LOAD_DATA_FINISH',
}
*/
```

## Examples

In these examples, we will call a very simple HTTP API. A call to the route `/<status>/<contentType>` will respond
with appropriate status and content type header. A simple implementation of this server is used in the test.

### Basic example:

```js
const fetchMiddleware = createFetchMiddleware({
  baseUrl: 'http://some.host/api',
});

const reducer = (state = [], action) => {
  if (action.type.startsWith('@@redux'))
    return state;

  return [ ...state, action ];
};

const store = createStore(reducer, applyMiddleware(fetchMiddleware));

const hello = new FetchAction('HELLO')
  .get('/');

const fail400 = new FetchAction('FAIL_400')
  .put('/400')
  .body({ some: 'body' });

const fail200 = new FetchAction('FAIL_200')
  .get('/')
  .expect([400, 404]);

const ok500 = new FetchAction('OK_500')
  .get('/500/text')
  .header('Custom', 42)
  .opts({ cache: 'no-cache', mode: 'cors' })
  .expect(500);

Promise.resolve()
  .then(() => store.dispatch(hello))
  .then(() => store.dispatch(fail400))
  .then(() => store.dispatch(fail200))
  .then(() => store.dispatch(ok500))
  .then(() => console.log(store.getState()));

/*
[
  { type: 'HELLO_REQUEST', url: 'http://localhost:4242/', method: 'GET' },
  { type: 'HELLO_SUCCESS', status: 200, duration: 12 },
  { type: 'HELLO_FINISH', duration: 12 },

  { type: 'FAIL_400_REQUEST', url: 'http://localhost:4242/400', headers: { 'Content-Type': 'application/json' }, method: 'PUT', body: { some: 'body' } },
  { type: 'FAIL_400_FAILURE', status: 400, duration: 2 },
  { type: 'FAIL_400_FINISH', duration: 2 },

  { type: 'FAIL_200_REQUEST', url: 'http://localhost:4242/', method: 'GET' },
  { type: 'FAIL_200_FAILURE', status: 200, duration: 0 },
  { type: 'FAIL_200_FINISH', duration: 0 },

  { type: 'OK_500_REQUEST', url: 'http://localhost:4242/500/text', headers: { Custom: 42 }, method: 'GET', cache: 'no-cache', mode: 'cors' },
  { type: 'OK_500_SUCCESS', status: 500, duration: 1, body: 'GET /500/text -> 500' },
  { type: 'OK_500_FINISH', duration: 1 },
]
*/
```

### With custom suffixes:

```js
const fetchMiddleware = createFetchMiddleware({
  baseUrl: 'http://some.host/api',
  suffixes: {
    request: '-START',
    success: '-OK',
    failure: '-FAIL',
    finish: '-DONE',
  },
});

/* ... */
```

### Using createFetchActionTypes

```js
const FETCH_PLAYER = createFetchActionTypes('FETCH_PLAYER');
const fetchPlayer = playerId => {
  return new FetchAction('FETCH_PLAYER')
    .get('/players/' + playerId);
}

const reducer = (state = {
  fetchingPlayer: false,
  player: null,
  error: null,
}, action) => {
  switch (action.type) {
    case FETCH_PLAYER.REQUEST:
      return { ...state, fetchingPlayer: true };

    case FETCH_PLAYER.FINISH:
      return { ...state, fetchingPlayer: false };

    case FETCH_PLAYER.SUCCESS:
      return { ...state, player: action.body };

    case FETCH_PLAYER.FAILURE:
      return { ...state, player: null, error: action.body };

    default:
      return state;
  }
};
```

### Dispatching custom actions

```js
const fetchMiddleware = createFetchMiddleware({
  baseUrl: 'http://some.host/api',
  onRequest: () => false,
  onSuccess: () => false,
  onFailure: () => false,
  onFinish: () => false,
});

/* ... */

const hello = new FetchAction('HELLO')
  .get('/418/json')
  .expect(418)
  .onRequest((dispatch, getState, url, opts, body) => {
    console.log('Starting request...');

    dispatch({ type: 'LOADING' });

    return false;
  })
  .onSuccess((dispatch, getState, status, body, duration) => {
    console.log('Request succeeded!', 'status: ' + status);

    dispatch({ type: 'STORE_DATA', data: body });

    return true;
  })
  .onFinish((dispatch, getState, duration) => {
    console.log('Request terminated.');

    dispatch({ type: 'LOADING_FINISH', duration });

    return false;
  });

store.dispatch(hello)
  .then(({ response, duration, body }) => console.log('statusText: ' + response.statusText))
  .then(() => console.log(store.getState()));

/*
Starting request...
Request succeeded! status: 418
Request terminated.
statusText: I'm a teapot
[
  { type: "LOADING" },
  { type: "STORE_DATA", data: { method: "GET", url: "/418/json", ... } },
  { type: "HELLO_SUCCESS", status: 418, duration: 12, body: { method: "GET", url: "/418/json", ... } },
  { type: "LOADING_FINISH", duration: 12 },
]
*/
```

### License

[MIT](./LICENSE.md)
