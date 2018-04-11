const fetch = require('isomorphic-fetch');

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
    this._opts = {
      headers: {},
    };

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

function ExtendableBuiltin(cls) {
    function ExtendableBuiltin(){
        cls.apply(this, arguments);
    }

    ExtendableBuiltin.prototype = Object.create(cls.prototype);
    Object.setPrototypeOf(ExtendableBuiltin, cls);

    return ExtendableBuiltin;
}

class FetchError extends ExtendableBuiltin(Error) {
  constructor(url, opts, response, body) {
    super([
      opts.method || 'GET',
      url,
      '->',
      response.status,
      // ['(', response.statusText, ')'].join(''),
    ].join(' '));

    this.url = url;
    this.opts = opts;
    this.response = response;
    this.body = body;
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
    const startDate = null;

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
    if (!onRequest || onRequest(dispatch, getState)) {
      const contentType = fetchOpts.headers['Content-Type'];
      let body = fetchOpts.body;

      if (contentType && contentType.match(/^application\/json/))
        body = JSON.parse(body);

      dispatch({ type: prefix + suffixes.request, url, ...fetchOpts, body });
    }
  };

  const dispatchResult = () => {
    const status = res.status;
    const ok = (!expect && res.ok) || (expect && expect.includes(status));
    const f = ok ? onSuccess : onFailure;
    const suffix = ok ? suffixes.success : suffixes.failure;

    if (!f || f(dispatch, getState, status, body))
      dispatch({ type: prefix + suffix, status, duration, body });
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
    .then(() => ({ result: res, duration, body }));
};

const configure = opts => {
  let { baseUrl, suffixes, fetch: _fetch } = opts || {};

  suffixes = suffixes || {};
  suffixes.request = suffixes.request || '_REQUEST';
  suffixes.success = suffixes.success || '_SUCCESS';
  suffixes.failure = suffixes.failure || '_FAILURE';
  suffixes.finish = suffixes.finish || '_FINISH';

  return fetchMiddleware({
    baseUrl: baseUrl || '',
    suffixes,
    fetch: _fetch || fetch,
    ...opts,
  });
};

const createFetchActionTypes = prefix => ({
  REQUEST: prefix + '_REQUEST',
  SUCCESS: prefix + '_SUCCESS',
  FAILURE: prefix + '_FAILURE',
  FINISH: prefix + '_FINISH',
});

module.exports = configure;
module.exports.FetchAction = FetchAction;
module.exports.FetchError = FetchError;
module.exports.createFetchActionTypes = createFetchActionTypes;