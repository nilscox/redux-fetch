const http = require('http');
const expect = require('chai').expect;
const { createStore, applyMiddleware } = require('redux');
const { createFetchMiddleware, FetchAction } = require('.');

const PORT = 7537;
const PREFIX = 'HELLO';

const BASE_CONFIG = {
  baseUrl: 'http://localhost:' + PORT,
};

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

  describe('url', () => {

    it('should call fetch with the correct url', async () => {
      const action = new FetchAction(PREFIX)
        .get('/walala');

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

});
