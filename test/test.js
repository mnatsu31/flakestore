'use strict';

import assert from 'power-assert';

import FlakeStore from '../';
import { mergeHandlers } from '../lib/utils/mergeHandlers';

const store = new FlakeStore();

const INIT = 'INIT';
const INCREMENTS = 'INCREMENTS';
const DECREMENTS = 'DECREMENTS';
const ERROR = 'ERROR';

let counter = (state = 0, action) => {
  switch(action.actionType) {
    case INCREMENTS:
      return state + 1;
    case DECREMENTS:
      return state - 1;
    default:
      return state;
  }
}

let asyncCounter = (state = 0, action) => {
  switch(action.actionType) {
    case INCREMENTS:
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve(state + 1);
        }, 1000);
      });
    case DECREMENTS:
      return state - 1;
    default:
      return state;
  }
}

let errorHandler = (state = void 0, action) => {
  switch (action.actionType) {
    case ERROR:
      throw new Error('error');
    default:
      return state;
  }
}

let merged = mergeHandlers([counter, errorHandler]);

describe('FlakeStore', () => {
  it('handler test', () => {
    let state = counter(void 0, { actionType: INIT });
    assert.equal(state, 0);

    state = counter(state, { actionType: INCREMENTS });
    assert.equal(state, 1);

    state = counter(state, { actionType: INCREMENTS });
    assert.equal(state, 2);

    state = counter(state, { actionType: DECREMENTS });
    assert.equal(state, 1);

    state = counter(state, { actionType: INCREMENTS });
    assert.equal(state, 2);

    state = counter(state, { actionType: INCREMENTS });
    assert.equal(state, 3);
  });
  it('sync flow test', (done) => {
    store.register({ counter });

    let subscriber = () => {
      let state = store.getState();
      if (state.counter === 3) {
        store.unsubscribe(subscriber);
        done();
      }
    };

    store.subscribe(subscriber);

    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: DECREMENTS });
    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: INCREMENTS });
  });
  it('async flow test', (done) => {
    store.register({ asyncCounter });

    let subscriber = () => {
      let state = store.getState();
      if (state.asyncCounter === 3) {
        store.unsubscribe(subscriber);
        store.unregister({ counter, asyncCounter });
        done();
      }
    };

    store.subscribe(subscriber);

    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: DECREMENTS });
    store.dispatch({ actionType: INCREMENTS });
    store.dispatch({ actionType: INCREMENTS });
  });
  it('error test', (done) => {
    store.register({ errorHandler });

    let subscriber = () => { /* ..do anything */ };
    store.subscribe(subscriber);

    store.onError(() => {
      store.unregister({ errorHandler });
      done();
    });

    store.dispatch({ actionType: ERROR });
  });
  it ('merge handlers', (done) => {
    store.register({ merged });

    let emitError = false

    let subscriber = () => {
      let state = store.getState();
      if (state.merged === 3 && emitError) {
        store.unsubscribe(subscriber);
        done();
      }
    };

    store.subscribe(subscriber);

    store.onError(() => {
      emitError = true;
    });

    store.dispatch({ actionType: ERROR });

    setTimeout(() => {
      store.dispatch({ actionType: INCREMENTS });
      store.dispatch({ actionType: INCREMENTS });
      store.dispatch({ actionType: INCREMENTS });
    }, 1000);
  });
  it('unregister handlers', () => {
    assert.equal(store.handlers.length, 1);
    store.unregister({ merged });
    assert.equal(store.handlers.length, 0);
  });
});
