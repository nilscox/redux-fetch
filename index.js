const isomorphicFetch = require('isomorphic-fetch');

const HTTP_METHODS = [
  'OPTIONS',
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
  'PATCH',
];

class FetchAction {
  static buildQueryString(params) {
    if (!params)
      return '';

    const keys = Object.keys(params);

    if (keys.length === 0)
      return '';

    // eslint-disable-next-line prefer-template
    return '?' + keys.map(key => key + '=' + params[key]).join('&');
  }

  constructor(prefix) {
    if (!prefix)
      throw new Error('prefix is required');

    this._prefix = prefix;

    this._baseUrl = null;
    this._route = '/';
    this._opts = {};

    this._expect = null;

    this._bodyParser = null;

    this._onRequest = null;
    this._onSuccess = null;
    this._onFailure = null;
    this._onFinish = null;

    HTTP_METHODS.forEach(method => {
      this[method.toLowerCase()] = (route, params) => {
        this._route = route + FetchAction.buildQueryString(params);
        this._opts.method = method;

        return this;
      };
    });
  }

  baseUrl(url) {
    this._baseUrl = url;
    return this;
  }

  body(body) {
    if (!body) {
      delete this._opts.body;

      this.header('Content-Type', null);
      this.header('Content-Length', null);

      return this;
    }

    if (typeof body === 'object') {
      this.header('Content-Type', 'application/json');
      this._opts.body = JSON.stringify(body);
    } else if (typeof body === 'string') {
      this.header('Content-Type', 'text/plain');
      this._opts.body = body;
    } else {
      throw new Error('invalid body type: ', typeof body);
    }

    this.header('Content-Length', this._opts.body.length);

    return this;
  }

  header(key_, value) {
    const key = key_.toLowerCase();

    if (!this._opts.headers)
      this._opts.headers = {};

    if (!value) {
      delete this._opts.headers[key];

      if (Object.keys(this._opts.headers).length === 0)
        delete this._opts.headers;
    } else {
      this._opts.headers[key] = value;
    }

    return this;
  }

  opts(opts) {
    Object.assign(this._opts, opts);
    return this;
  }

  expect(values) {
    this._expect = Array.isArray(values) ? values : [values];
    return this;
  }

  responseBodyParser(f) {
    this._bodyParser = f;
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

const requestAction = (prefix, suffix, url, opts, body) => {
  const action = {
    type: `${prefix}${suffix}`,
    url,
    ...opts,
  };

  if (body)
    action.body = body;

  return action;
};

const resultAction = (prefix, suffix, status, duration, body) => {
  const action = {
    type: `${prefix}${suffix}`,
    status,
    duration,
  };

  if (body)
    action.body = body;

  return action;
};

const finishAction = (prefix, suffix, duration) => ({
  type: `${prefix}${suffix}`,
  duration,
});

const defaultBodyParser = res => {
  const contentType = res.headers.get('Content-Type');

  if (!contentType)
    return Promise.resolve();

  if (contentType.match(/^application\/json/))
    return res.json();
  else if (contentType.match(/^text/))
    return res.text();

  return Promise.resolve();
};

const fetchMiddleware = config => store => next => action => {
  if (!(action instanceof FetchAction))
    return next(action);

  const { dispatch, getState } = store;
  const { baseUrl, fetch, suffixes } = config;

  const prefix = action._prefix;
  const route = action._route;
  const fetchOpts = action._opts;
  const expect = action._expect;
  const actionBaseUrl = action._baseUrl;

  const url = (actionBaseUrl || baseUrl) + route;

  const bodyParser = action._bodyParser || defaultBodyParser;

  const onRequest = action._onRequest || config.onRequest;
  const onSuccess = action._onSuccess || config.onSuccess;
  const onFailure = action._onFailure || config.onFailure;
  const onFinish = action._onFinish || config.onFinish;

  let res = null;
  let body = null;
  let duration = null;

  const fetchWithDuration = () => {
    const startDate = new Date();

    return fetch(url, fetchOpts)
      .then(r => res = r)
      .then(() => duration = new Date() - startDate);
  };

  const parseBody = () => {
    return Promise.resolve()
      .then(() => bodyParser(res))
      .then(b => body = b);
  };

  const shouldDispatchRequest = body => {
    if (!onRequest)
      return true;

    return onRequest(dispatch, getState, url, fetchOpts, body);
  };

  const dispatchRequest = () => {
    const contentType = fetchOpts.headers && fetchOpts.headers['content-type'];
    let body = fetchOpts.body;

    if (contentType && contentType.match(/^application\/json/))
      body = JSON.parse(body);

    if (shouldDispatchRequest(body))
      dispatch(requestAction(prefix, suffixes.request, url, fetchOpts, body));
  };

  const shouldDispatchResult = ok => {
    const f = ok ? onSuccess : onFailure;

    if (!f)
      return true;

    return f(dispatch, getState, res.status, body, duration);
  };

  const dispatchResult = () => {
    const status = res.status;
    const ok = (!expect && res.ok) || (expect && expect.includes(status));
    const suffix = ok ? suffixes.success : suffixes.failure;

    if (shouldDispatchResult(ok))
      dispatch(resultAction(prefix, suffix, status, duration, body));
  };

  const shouldDispatchFinish = () => {
    if (!onFinish)
      return true;

    return onFinish(dispatch, getState, duration);
  };

  const dispatchFinish = () => {
    if (shouldDispatchFinish())
      dispatch(finishAction(prefix, suffixes.finish, duration));
  };

  return Promise.resolve()
    .then(dispatchRequest)
    .then(fetchWithDuration)
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

const createMiddleware = config => fetchMiddleware(Object.assign({}, defaultConfig, config));

const createFetchActionTypes = prefix => ({
  REQUEST: prefix + defaultConfig.suffixes.request,
  SUCCESS: prefix + defaultConfig.suffixes.success,
  FAILURE: prefix + defaultConfig.suffixes.failure,
  FINISH: prefix + defaultConfig.suffixes.finish,
});

module.exports.FetchAction = FetchAction;
module.exports.createFetchMiddleware = createMiddleware;
module.exports.createFetchActionTypes = createFetchActionTypes;
