const fetch = require('isomorphic-fetch');

class FetchAction {
  constructor(prefix, route, opts) {
    if (!prefix)
      throw new Error('prefix is required');

    this._prefix = prefix;

    this._route = route || '/';
    this._opts = opts || {};

    this._expect = null;

    this._onRequest = null;
    this._onSuccess = null;
    this._onFailure = null;
    this._onFinish = null;
  }

  route(route) {
    this._route = route;
    return this;
  }

  setOpt(opt, value) {
    this._opts[opt] = value;
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

  fetch(fetch) {
    this._fetch = fetch;
  }
}

class FetchError extends Error {
  constructor(route, opts, response, body) {
    super([
      opts.method || 'GET',
      route,
      '->',
      response.statusCode,
      ['(', response.statusText, ')'].join(''),
    ].join(' '));

    this.route = route;
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

  const { dispatch, getState } = store;
  let res = null;
  let body = null;

  if (!onRequest || onRequest(dispatch, getState))
    dispatch({ type: prefix + suffixes.request, route, ...fetchOpts });

  return fetch(baseUrl + route, fetchOpts)
    .then(r => res = r)
    .then(() => {
      const contentType = res.headers.get('Content-Type');

      if (/^application\/json/.exec(contentType))
        return res.json();
      else if (/^text\//.exec(contentType))
        return res.text();
    })
    .then(b => body = b)
    .then(() => {
      if (expect && !expect.includes(res.status))
        throw new FetchError(route, opts, res, body);

      if (!expect && !res.ok)
        throw new FetchError(route, opts, res, body);

      if (!onSuccess || onSuccess(dispatch, getState, body))
        dispatch({ type: prefix + suffixes.success, body });
    })
    .catch(error => {
      if (!(error instanceof FetchError))
        throw error;

      if (!onFailure || onFailure(dispatch, getState, error))
        dispatch({ type: prefix + suffixes.failure, error });
    })
    .then(() => {
      if (!onFinish || onFinish(dispatch, getState))
        dispatch({ type: prefix + suffixes.finish });
    })
    .then(() => ({ result: res, body }));
};

const configure = opts => {
  let { baseUrl, suffixes, fetch: _fetch } = opts || {};

  baseUrl = baseUrl || '';
  suffixes = suffixes || {};

  suffixes.request = suffixes.request || '_REQUEST';
  suffixes.success = suffixes.success || '_SUCCESS';
  suffixes.failure = suffixes.failure || '_FAILURE';
  suffixes.finish = suffixes.finish || '_FINISH';

  _fetch = _fetch || fetch;

  return fetchMiddleware({ baseUrl, suffixes, fetch: _fetch });
};

module.exports = configure;
module.exports.FetchAction = FetchAction;
module.exports.FetchError = FetchError;
