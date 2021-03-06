const assert = require('assert');
const http = require('http');
const { createStore, applyMiddleware } = require('redux');
const { FetchAction, createFetchMiddleware, } = require('.');

const baseConfig = {
  baseUrl: 'http://localhost:7357',
}

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

const test = async (config, action, expected) => {
  let idx = 0;

  const reducer = (state, action) => {
    if (action.type.match(/^@@redux/))
      return;

    const assertion = expected[idx++];

    if (assertion)
      assertion(action);
  };

  const fetchMiddleware = createFetchMiddleware(config);
  const store = createStore(reducer, applyMiddleware(fetchMiddleware));
  const result = await store.dispatch(action);

  assert.strictEqual(idx, expected.length, [
    'Expected', expected.length,
    'action' + (expected.length >= 2 ? 's' : ''),
    'but got', idx,
    ].join(' '));

  return result;
};

const test_contentType = async () => {
  const test_contentType_json = async () => {
    const action = new FetchAction('HELLO').get('/200/json');
    const result = await test(baseConfig, action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'object');
  };

  const test_contentType_text = async () => {
    const action = new FetchAction('HELLO').get('/200/text');
    const result = await test(baseConfig, action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'string');
  };

  const test_contentType_none = async () => {
    const action = new FetchAction('HELLO');
    const result = await test(baseConfig, action, [null, null, null]);

    assert.strictEqual(typeof result.body, 'undefined');
  };

  return Promise.all([
    test_contentType_json(),
    test_contentType_text(),
    test_contentType_none(),
  ]);
};

const test_callbacks = async () => {
  const test_onRequest = async () => {
    const test_onRequest_return_true = async () => {
      const action = new FetchAction('HELLO')
        .onRequest(() => true);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onRequest_return_false = async () => {
      const action = new FetchAction('HELLO')
        .onRequest(() => false);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onRequest_params = async () => {
      const test_onRequest_param_url = async () => {
        const action = new FetchAction('HELLO')
          .onRequest((dispatch, getState, url, opts, body) => {
            assert.strictEqual(url, 'http://localhost:7357/');
            return true;
          });

        const expect = [null, null, null];

        await test(baseConfig, action, expect);
      };

      const test_onRequest_param_opts = async () => {
        const action = new FetchAction('HELLO')
          .opts({ custom: 42 })
          .onRequest((dispatch, getState, url, opts, body) => {
            assert.deepEqual(opts, { custom: 42 });
            return true;
          });

        const expect = [null, null, null];

        await test(baseConfig, action, expect);
      };

      const test_onRequest_param_body = async () => {
        const action = new FetchAction('HELLO')
          .body('coucou')
          .onRequest((dispatch, getState, url, opts, body) => {
            assert.deepEqual(body, 'coucou');
            return true;
          });

        const expect = [null, null, null];

        await test(baseConfig, action, expect);
      };

      const test_onRequest_param_other = async () => {
        const action = new FetchAction('HELLO')
          .body('coucou')
          .onRequest((dispatch, getState, url, opts, body) => {
            assert.strictEqual(typeof dispatch, 'function');
            assert.strictEqual(typeof getState, 'function');

            return true;
          });

        const expect = [null, null, null];

        await test(baseConfig, action, expect);
      };

      await Promise.all([
        test_onRequest_param_url(),
        test_onRequest_param_opts(),
        test_onRequest_param_body(),
        test_onRequest_param_other(),
      ]);
    };

    await Promise.all([
      test_onRequest_return_true(),
      test_onRequest_return_false(),
      test_onRequest_params(),
    ]);
  };

  const test_onSuccess = async () => {
    const test_onSuccess_return_true = async () => {
      const action = new FetchAction('HELLO')
        .onSuccess(() => true);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onSuccess_return_false = async () => {
      const action = new FetchAction('HELLO')
        .onSuccess(() => false);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onSuccess_params = async () => {
      const action = new FetchAction('HELLO')
        .put('/202/json')
        .onSuccess((dispatch, getState, status, body, duration) => {
          assert.strictEqual(typeof dispatch, 'function');
          assert.strictEqual(typeof getState, 'function');
          assert.strictEqual(typeof duration, 'number');
          assert.strictEqual(status, 202);
          assert.deepEqual(body, {
            method: 'PUT',
            url: '/202/json',
            contentType: 'json',
            status: 202,
          });

          return true;
        });

      const expect = [null, null, null];

      await test(baseConfig, action, expect);
    };

    await Promise.all([
      test_onSuccess_return_true(),
      test_onSuccess_return_false(),
      test_onSuccess_params(),
    ]);
  };

  const test_onFailure = async () => {
    const test_onFailure_return_true = async () => {
      const action = new FetchAction('HELLO')
        .onFailure(() => true);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onFailure_return_false = async () => {
      const action = new FetchAction('HELLO')
        .onSuccess(() => false);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onFailure_params = async () => {
      const action = new FetchAction('HELLO')
        .patch('/404/text')
        .onFailure((dispatch, getState, status, body, duration) => {
          assert.strictEqual(typeof dispatch, 'function');
          assert.strictEqual(typeof getState, 'function');
          assert.strictEqual(typeof duration, 'number');
          assert.strictEqual(status, 404);
          assert.strictEqual(body, 'PATCH /404/text -> 404');

          return true;
        });

      const expect = [null, null, null];

      await test(baseConfig, action, expect);
    };

    await Promise.all([
      test_onFailure_return_true(),
      test_onFailure_return_false(),
      test_onFailure_params(),
    ]);
  };

  const test_onFinish = async () => {
    const test_onFinish_return_true = async () => {
      const action = new FetchAction('HELLO')
        .onFinish(() => true);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
        action => assert.strictEqual(action.type, 'HELLO_FINISH'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onFinish_return_false = async () => {
      const action = new FetchAction('HELLO')
        .onFinish(() => false);

      const expect = [
        action => assert.strictEqual(action.type, 'HELLO_REQUEST'),
        action => assert.strictEqual(action.type, 'HELLO_SUCCESS'),
      ];

      await test(baseConfig, action, expect);
    };

    const test_onFinish_params = async () => {
      const action = new FetchAction('HELLO')
        .onFinish((dispatch, getState, duration) => {
          assert.strictEqual(typeof dispatch, 'function');
          assert.strictEqual(typeof getState, 'function');
          assert.strictEqual(typeof duration, 'number');
          return true;
        });

      const expect = [null, null, null];

      await test(baseConfig, action, expect);
    };

    await Promise.all([
      test_onFinish_return_true(),
      test_onFinish_return_false(),
      test_onFinish_params(),
    ]);
  };

  await Promise.all([
    test_onRequest(),
    test_onSuccess(),
    test_onFailure(),
    test_onFinish(),
  ]);
};

withServer(async () => {
  try {
    await Promise.all([
      test_contentType(),
      test_callbacks(),
    ]);
  } catch (err) {
    console.error(err);
  }
});
