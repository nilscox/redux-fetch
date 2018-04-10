const assert = require('assert');
const http = require('http');
const fetch = require('node-fetch');
const { createStore, applyMiddleware } = require('redux');
const promiseMiddleware = require('redux-promise');
const reduxFetch = require('.');

const fetchMiddleware = reduxFetch({
  baseUrl: 'http://localhost:7357',
});

const withServer = async f => {
  const server = http.createServer((req, res) => {
    const match = req.url.match(/\/([0-9]{3})(\/(text|json))?\/?/);
    const status = match && ~~match[1] || 200;
    const contentType = match && match[3] || null;
    const headers = {};
    let body = null;

    if (contentType === 'json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        method: req.method,
        url: req.url,
        contentType,
        status,
      });
    } else if (contentType === 'text') {
      headers['Content-Type'] = 'text/plain';
      body = [req.method, req.url, '->', status].join(' ');
    }

    res.writeHead(status, headers);

    if (body)
      res.write(body);

    res.end();
  });

  server.listen(7357);

  await f();

  server.close();
};

const FetchAction = reduxFetch.FetchAction;

const test = async (action, expected) => {
  let idx = 0;

  const reducer = (state, action) => {
    if (action.type.match(/^@@redux/))
      return;

    const assertion = expected[idx++];

    if (assertion)
      assertion(action);
  };

  const store = createStore(reducer, applyMiddleware(
    fetchMiddleware,
    promiseMiddleware,
  ));

  const result = await store.dispatch(action);

  assert.strictEqual(idx, expected.length, [
    'Expected', expected.length,
    'action' + (expected.length >= 2 ? 's' : ''),
    'but got', idx,
    ].join(' '));

  return result;
};

const test_noprefix = async () => {
  const store = createStore(() => {}, applyMiddleware(
    fetchMiddleware,
    promiseMiddleware,
  ));

  try {
    await store.dispatch(new FetchAction());
  } catch (err) {
    assert(err.message.match(/prefix is required/));
  }
};

const test_prefix = async () => {
  const action = new FetchAction('HELLO');
  const expected = [
    action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
    action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
    action => assert.strictEqual(action.type, 'HELLO_FINISH'),
  ];

  await test(action, expected);
};

const test_url = async () => {
  const action = new FetchAction('HELLO').get('/walala');
  const expected = [
    action => assert.strictEqual(action.url, 'http://localhost:7357/walala'),
    null, null,
  ];

  await test(action, expected);
};

const test_opts = async () => {
  const action = new FetchAction('HELLO').opts({ custom: 42 });
  const expected = [
    action => {
      assert.ok(action.custom);
      assert.strictEqual(action.custom, 42);
    },
    null, null,
  ];

  await test(action, expected);
};

const test_expect = async () => {
  const expectSuccess = [
    null,
    action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
    null,
  ];

  const expectFailure = [
    null,
    action => assert.strictEqual(action.type, 'HELLO_FAILURE'),
    null,
  ];

  const expect = [{
    action: new FetchAction('HELLO'),
    expected: expectSuccess,
  }, {
    action: new FetchAction('HELLO').get('/401'),
    expected: expectFailure,
  }, {
    action: new FetchAction('HELLO').expect(200),
    expected: expectSuccess,
  }, {
    action: new FetchAction('HELLO').get('/400').expect(400),
    expected: expectSuccess,
  }, {
    action: new FetchAction('HELLO').expect([200, 201]),
    expected: expectSuccess,
  }, {
    action: new FetchAction('HELLO').get('/404').expect(200),
    expected: expectFailure,
  }, {
    action: new FetchAction('HELLO').expect(404),
    expected: expectFailure,
  }, {
    action: new FetchAction('HELLO').get('/300').expect([200, 300, 400]),
    expected: expectSuccess,
  }, {
    action: new FetchAction('HELLO').get('/500').expect([200, 300, 400]),
    expected: expectFailure,
  }];

  await Promise.all(expect.map(o => test(o.action, o.expected)));
};

const test_contentType = async () => {
  const test_contentType_json = async () => {
    const action = new FetchAction('HELLO').get('/200/json');
    const result = await test(action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'object');
  };

  const test_contentType_text = async () => {
    const action = new FetchAction('HELLO').get('/200/text');
    const result = await test(action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'string');
  };

  const test_contentType_none = async () => {
    const action = new FetchAction('HELLO');
    const result = await test(action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'undefined');
  };

  return Promise.all([
    test_contentType_json(),
    test_contentType_text(),
    test_contentType_none(),
  ]);
};

withServer(async () => {
  try {
    await Promise.all([
      test_noprefix(),
      test_prefix(),
      test_url(),
      test_opts(),
      test_expect(),
      test_contentType(),
    ]);
  } catch (err) {
    console.error(err);
  }
});
