const expect = require('chai').expect;
const { createStore, applyMiddleware } = require('redux');
const { createFetchMiddleware, FetchAction } = require('.');

const PREFIX = 'HELLO';

const test = (action, expected, config) => {
  const fetchMiddleware = createFetchMiddleware(config);

  let idx = 0;

  const reducer = (state, action) => {
    if (action.type.match(/^@@redux/))
      return;

    const expectedFunc = expected[idx++];

    if (expectedFunc)
      expected(action);
  };

  const store = createStore(reducer, applyMiddleware(fetchMiddleware));

  store.dispatch(action);
};

describe('redux-fetch', () => {

  describe('prefix', () => {

    it('should fail when instanciating a FetchAction without a prefix', () => {
      expect(() => new FetchAction()).to.throw('prefix is required');
    });

    it('should dispatch actions with correct prefix', () => {
      const action = new FetchAction(PREFIX);
      const expected = [
        action => expect(action).to.have.property('type', PREFIX + '_REQUEST'),
        action => expect(action).to.have.property('type', PREFIX + '_SUCCESS'),
        action => expect(action).to.have.property('type', PREFIX + '_FINISH'),
      ];

      test(action, expected);
    });

  });

});
