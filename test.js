const http = require('http');
const expect = require('chai').expect;
const { createStore, applyMiddleware } = require('redux');
const { createFetchMiddleware, FetchAction } = require('.');

const PORT = 7537;
const PREFIX = 'HELLO';
const NULL3 = [null, null, null];

const BASE_CONFIG = {
  baseUrl: 'http://localhost:' + PORT,
};

const wrapFetch = f => (url, opts) => {
  f(url, opts);
  return fetch(url, opts);
}

const makeConfig = config => Object.assign({}, BASE_CONFIG, config);

const test = async (action, expected, config = BASE_CONFIG) => {
  const fetchMiddleware = createFetchMiddleware(config);

  let idx = 0;

  const reducer = (state, action) => {
    if (action.type.match(/^@@redux/))
      return;

    const expectedFunc = expected[idx++];

    if (expectedFunc)
      expectedFunc(action);
  };

  const store = createStore(reducer, applyMiddleware(fetchMiddleware));

  await store.dispatch(action);

  expect(idx).to.equal(expected.length);
};

const createServer = () => {
  return http.createServer((req, res) => {
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
}

describe('redux-fetch', () => {

  let server = null;

  before(() => {
    server = createServer();
    server.listen(PORT);
  });

  after(() => {
    server.close();
  });

  describe('prefix', () => {

    it('should fail when instanciating a FetchAction without a prefix', () => {
      expect(() => new FetchAction()).to.throw('prefix is required');
    });

    it('should dispatch actions with correct prefix', async () => {
      const action = new FetchAction(PREFIX);

      const expected = [
        action => expect(action).to.have.property('type', PREFIX + '_REQUEST'),
        action => expect(action).to.have.property('type', PREFIX + '_SUCCESS'),
        action => expect(action).to.have.property('type', PREFIX + '_FINISH'),
      ];

      await test(action, expected);
    });

  });

  describe('headers', () => {
    const actions = {
      noHeaders: new FetchAction(PREFIX),
      singleHeader: new FetchAction(PREFIX).header('Foo', 'bar'),
      multipleHeaders: new FetchAction(PREFIX).header('Foo', 'bar').header('Baz', 42),
      overrideHeader: new FetchAction(PREFIX).header('Foo', 'bar').header('Foo', 42),
    };

    const expectConfig = {
      noHeaders: makeConfig({
        fetch: wrapFetch((url, opts) => expect(opts).to.not.have.property('headers')),
      }),
      singleHeader: makeConfig({
        fetch: wrapFetch((url, opts) => {
          expect(opts).to.have.property('headers');
          expect(opts).to.satisfy(a => a.headers.get('Foo') === 'bar');
        }),
      }),
      multipleHeaders: makeConfig({
        fetch: wrapFetch((url, opts) => {
          expect(opts).to.have.property('headers');
          expect(opts).to.satisfy(a => a.headers.get('Foo') === 'bar');
          expect(opts).to.satisfy(a => a.headers.get('Baz') === 42);
        }),
      }),
      overrideHeader: makeConfig({
        fetch: wrapFetch((url, opts) => {
          expect(opts).to.have.property('headers');
          expect(opts).to.satisfy(a => a.headers.get('Foo') === 42);
        }),
      }),
    };

    it('should call fetch no custom headers', async () => {
      await test(actions.noHeaders, NULL3, expectConfig.noHeaders);
    });

    it('should call fetch with a single custom header', async () => {
      await test(actions.singleHeader, NULL3, expectConfig.singleHeader);
    });

    it('should call fetch with multiple custom headers', async () => {
      await test(actions.multipleHeaders, NULL3, expectConfig.multipleHeaders);
    });

    it('should call fetch with custom header override', async () => {
      await test(actions.overrideHeader, NULL3, expectConfig.overrideHeader);
    });

  });

  describe('url', () => {

    describe('route', () => {
      const action = new FetchAction(PREFIX).get('/walala');

      it('should call fetch with the correct url', async () => {
        const config = makeConfig({
          fetch: wrapFetch((url, opts) => expect(url).to.match(/\/walala$/)),
        });

        await test(action, NULL3, config);
      });

      it('should dispatch a request action with the correct url', async () => {
        const expected = [
          action => {
            expect(action).to.have.property('url');
            expect(action.url).to.match(/\/walala$/);
          },
          null,
          null,
        ];

        await test(action, expected);
      });

    });

    describe('query string', () => {
      const action = new FetchAction(PREFIX).get('/', { foo: 'bar', baz: 42 });

      it('should call fetch with an empty query string', async () => {
        const action = new FetchAction(PREFIX).get('/', {});

        const config = makeConfig({
          fetch: wrapFetch((url, opts) => expect(url).to.match(/\/$/)),
        });

        await test(action, NULL3, config);
      });

      it('should call fetch with a correct query string', async () => {
        const config = makeConfig({
          fetch: wrapFetch((url, opts) => expect(url).to.match(/\/?foo=bar&baz=42$/)),
        });

        await test(action, NULL3, config);
      });

      it('should dispatch a request action with a correct query string', async () => {
        const expected = [
          action => {
            expect(action).to.have.property('url');
            expect(action.url).to.match(/\/?foo=bar&baz=42$/);
          },
          null,
          null,
        ];

        await test(action, expected);
      });

    });

  });

  describe('body', () => {

    describe('string', () => {
      const action = new FetchAction(PREFIX).body('coucou');

      it('should set the request body to "coucou"', async () => {
        const expected = [
          action => expect(action).to.have.property('body', 'coucou'),
          null,
          null,
        ];

        const config = makeConfig({
          fetch: wrapFetch((url, opts) => expect(opts).to.have.property('body', 'coucou')),
        });

        await test(action, expected, config);
      });

      it('should set the Content-Type request header to text/plain', async () => {
        const expected = [
          action => {
            expect(action).to.have.property('headers');
            expect(action).to.satisfy(a => a.headers.get('Content-Type') === 'text/plain');
          },
          null,
          null,
        ];

        const config = makeConfig({
          fetch: wrapFetch((url, opts) => {
            expect(opts).to.have.property('headers');
            expect(opts).to.satisfy(o => o.headers.get('Content-Type') === 'text/plain');
          }),
        });

        await test(action, expected, config);
      });

      it('should set the Content-Length request header to 6', async () => {
        const expected = [
          action => {
            expect(action).to.have.property('headers');
            expect(action).to.satisfy(a => a.headers.get('Content-Length') === 6);
          },
          null,
          null,
        ];

        const config = makeConfig({
          fetch: wrapFetch((url, opts) => {
            expect(opts).to.have.property('headers');
            expect(opts).to.satisfy(o => o.headers.get('Content-Length') === 6);
          }),
        });

        await test(action, expected, config);
      });

    });

  });

  describe('opts', () => {
    const action = new FetchAction(PREFIX).opts({ custom: 42, foo: 'bar' });

    it('should call fetch with custom options', async () => {
      const config = makeConfig({
        fetch: wrapFetch((url, opts) => {
          expect(opts).to.have.property('custom', 42);
          expect(opts).to.have.property('foo', 'bar');
        }),
      });

      await test(action, NULL3, config);
    });

    it('should dispatch a request action with custom options', async () => {
      const expected = [
        action => {
          expect(action).to.have.property('custom', 42);
          expect(action).to.have.property('foo', 'bar');
        },
        null,
        null
      ];

      await test(action, expected);
    });

  });

  describe('expect', () => {
    const expectSuccess = [
      null,
      action => expect(action.type).to.match(/_SUCCESS$/),
      null
    ];

    const expectFailure = [
      null,
      action => expect(action.type).to.match(/_FAILURE$/),
      null
    ];

    describe('no expected value', () => {

      it('should dispatch a success action when the response status is 200 and no expected value is set', async () => {
        await test(new FetchAction(PREFIX), expectSuccess);
      });

      it('should dispatch a success action when the response status is 201 and no expected value is set', async () => {
        await test(new FetchAction(PREFIX).get('/201'), expectSuccess);
      });

      it('should dispatch a failure action when the response status is 400 and no expected value is set', async () => {
        await test(new FetchAction(PREFIX).get('/400'), expectFailure);
      });

    });

    describe('single expected value', () => {

      it('should dispatch a success action when the response status is 200 and expected value is 200', async () => {
        await test(new FetchAction(PREFIX).expect(200), expectSuccess);
      });

      it('should dispatch a success action when the response status is 400 and expected value is 400', async () => {
        await test(new FetchAction(PREFIX).get('/400').expect(400), expectSuccess);
      });

      it('should dispatch a failure action when the response status is 200 and expected value is 400', async () => {
        await test(new FetchAction(PREFIX).expect(400), expectFailure);
      });

      it('should dispatch a failure action when the response status is 400 and expected value is 200', async () => {
        await test(new FetchAction(PREFIX).get('/400').expect(200), expectFailure);
      });

    });

    describe('multiple expected values', () => {

      it('should dispatch a success action when the response status is 200 and expected value is within [200, 400]', async () => {
        await test(new FetchAction(PREFIX).expect([200, 400]), expectSuccess);
      });

      it('should dispatch a success action when the response status is 200 and expected value is within [400, 200]', async () => {
        await test(new FetchAction(PREFIX).expect([400, 200]), expectSuccess);
      });

      it('should dispatch a failure action when the response status is 300 and expected value is within [200, 400]', async () => {
        await test(new FetchAction(PREFIX).get('/300').expect([200, 400]), expectFailure);
      });

      it('should dispatch a failure action when the response status is 418 and expected value is within [200, 300, 400]', async () => {
        await test(new FetchAction(PREFIX).get('/418').expect([200, 300, 400]), expectFailure);
      });

      it('should dispatch a success action when the response status is 418 and expected value is within [200, 300, 418, 400]', async () => {
        await test(new FetchAction(PREFIX).get('/418').expect([200, 300, 418, 400]), expectSuccess);
      });

    });

  });

});
