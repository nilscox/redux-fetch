const isomorphicFetch = require('isomorphic-fetch');

class FetchAction {
  static buildQueryString(params) {
    if (!params)
      return '';

    const keys = Object.keys(params);

    if (keys.length === 0)
      return '';

    return '?' + keys.map(key => key + '=' + params[key]).join('&');
  }

  constructor(prefix) {
    if (!prefix)
      throw new Error('prefix is required');

    this._prefix = prefix;

    this._route = '/';
    this._opts = {};

    this._expect = null;

    this._onRequest = null;
    this._onSuccess = null;
    this._onFailure = null;
    this._onFinish = null;

    [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ].forEach(method => {
      this[method.toLowerCase()] = (route, params) => {
        this._route = route + FetchAction.buildQueryString(params);
        this._opts.method = method;

        return this;
      };
    });
  }

  body(body) {
    if (typeof body === 'object') {
      this.header('Content-Type', 'application/json');
      this._opts.body = JSON.stringify(body);
    } else {
      this.header('Content-Type', 'text/plain');
      this._opts.body = new String(body);
    }

    return this;
  }

  header(key, value) {
    if (!this._opts.headers)
      this._opts.headers = {};

    this._opts.headers[key] = value;

    return this;
  }

  opts(opts) {
    Object.assign(this._opts, opts);
    return this;
  }

  expect(values) {
    if (!Array.isArray(values))
      values = [values];

    this._expect = values;

    return this;
  }

  onRequest(f) {
    this._onRequest = f;
    return this;
  }

  onSuccess(f) {
    this._onSuccess = f;
    return this;
  }

  onFailure(f) {
    this._onFailure = f;
    return this;
  }

  onFinish(f) {
    this._onFinish = f;
    return this;
  }
}

const fetchMiddleware = opts => store => next => action => {
  if (!(action instanceof FetchAction))
    return next(action);

  const baseUrl = opts.baseUrl;
  const fetch = opts.fetch;
  const suffixes = opts.suffixes;

  const prefix = action._prefix;
  const route = action._route;
  const fetchOpts = action._opts;
  const expect = action._expect;

  const onRequest = action._onRequest || opts.onRequest;
  const onSuccess = action._onSuccess || opts.onSuccess;
  const onFailure = action._onFailure || opts.onFailure;
  const onFinish = action._onFinish || opts.onFinish;

  const url = baseUrl + route;

  const { dispatch, getState } = store;

  let res = null;
  let body = null;
  let duration = null;

  const doFetch = () => {
    const startDate = new Date();

    return fetch(url, fetchOpts)
      .then(r => res = r)
      .then(() => duration = new Date() - startDate);
  }

  const parseBody = () => {
    return Promise.resolve()
      .then(() => {
        const contentType = res.headers.get('Content-Type');

        if (/^application\/json/.exec(contentType))
          return res.json();
        else if (/^text\//.exec(contentType))
          return res.text();
      })
      .then(b => body = b);
  };

  const dispatchRequest = () => {
    if (!onRequest || onRequest(dispatch, getState, url, fetchOpts, body)) {
      const contentType = fetchOpts.headers && fetchOpts.headers['Content-Type'];
      let body = fetchOpts.body;

      if (contentType && contentType.match(/^application\/json/))
        body = JSON.parse(body);

      const action = { type: prefix + suffixes.request, url, ...fetchOpts };

      if (body)
        action.body = body;

      dispatch(action);
    }
  };

  const dispatchResult = () => {
    const status = res.status;
    const ok = (!expect && res.ok) || (expect && expect.includes(status));
    const f = ok ? onSuccess : onFailure;
    const suffix = ok ? suffixes.success : suffixes.failure;

    if (!f || f(dispatch, getState, status, body, duration)) {
      const action = { type: prefix + suffix, status, duration };

      if (body)
        action.body = body;

      dispatch(action);
    }
  };

  const dispatchFinish = () => {
    if (!onFinish || onFinish(dispatch, getState, duration))
      dispatch({ type: prefix + suffixes.finish, duration });
  };

  return Promise.resolve()
    .then(dispatchRequest)
    .then(doFetch)
    .then(parseBody)
    .then(dispatchResult)
    .then(dispatchFinish)
    .then(() => ({ response: res, duration, body }));
};

const defaultConfig = {
  fetch: isomorphicFetch,
  baseUrl: '',
  suffixes: {
    request: '_REQUEST',
    success: '_SUCCESS',
    failure: '_FAILURE',
    finish: '_FINISH',
  },
};

const createMiddleware = config => {
  config = Object.assign({}, defaultConfig, config);

  return fetchMiddleware(config);
};

const createFetchActionTypes = prefix => ({
  REQUEST: prefix + defaultConfig.suffixes.request,
  SUCCESS: prefix + defaultConfig.suffixes.success,
  FAILURE: prefix + defaultConfig.suffixes.failure,
  FINISH: prefix + defaultConfig.suffixes.finish,
});

module.exports.FetchAction = FetchAction;
module.exports.createFetchMiddleware = createMiddleware;
module.exports.createFetchActionTypes = createFetchActionTypes;