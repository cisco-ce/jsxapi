import Backend from '../../src/backend';
import XAPI from '../../src/xapi';
import Feedback from '../../src/xapi/feedback';

function getPath(obj, ...path) {
  let tmp = obj;

  while (typeof tmp === 'object' && path.length) {
    const key = path.shift();
    tmp = tmp[key];
  }

  return tmp;
}

describe('Feedback', () => {
  let sandbox;
  let interceptor;
  let feedback;
  let xapi;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    interceptor = sandbox.stub();
    interceptor.callsArg(1);
    xapi = new XAPI(new Backend(), {
      feedbackInterceptor: interceptor,
    });
    feedback = xapi.feedback;

    let nextSubscriptionId = 0;
    sandbox.stub(XAPI.prototype, 'execute').callsFake((method) => {
      switch (method) {
        case 'xFeedback/Subscribe': {
          const id = nextSubscriptionId;
          nextSubscriptionId += 1;
          return Promise.resolve({ Id: id });
        }
        default:
          return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('is instance of Feedback', () => {
    expect(feedback).to.be.instanceof(Feedback);
  });

  describe('.dispatch()', () => {
    it('returns this', () => {
      expect(feedback.dispatch({ Status: 'foo' })).to.equal(feedback);
    });

    it('fires event', () => {
      const spy = sandbox.spy();
      feedback.on('Status', spy);
      feedback.dispatch({ Status: 'foo' });
      expect(spy).to.have.been.calledOnce();
      expect(spy).to.have.been.calledWith('foo');
    });

    it('fires events recursively', () => {
      const data = { Status: { Audio: { Volume: '50' } } };
      const spies = Array(4)
        .fill()
        .map(() => sandbox.spy());

      feedback.on('', spies[0]);
      feedback.on('Status', spies[1]);
      feedback.on('Status/Audio', spies[2]);
      feedback.on('Status/Audio/Volume', spies[3]);
      feedback.dispatch(data);

      [data, data.Status, data.Status.Audio, data.Status.Audio.Volume].forEach(
        (d, i) => {
          expect(spies[i].firstCall).to.have.been.calledWith(d);
        },
      );
    });

    it('does not invoke unrelated handlers', () => {
      const spy1 = sandbox.spy();
      const spy2 = sandbox.spy();

      feedback.on('Status/Audio/Volume', spy1);
      feedback.on('Status/Audio/VolumeMute', spy2);
      feedback.dispatch({ Status: { Audio: { VolumeMute: 'off' } } });

      expect(spy1).to.not.have.been.called();
      expect(spy2).to.have.been.calledOnce();
      expect(spy2).to.have.been.calledWith('off');
    });

    it('dispatches original feedback payload as second argument', () => {
      const spy = sandbox.spy();
      const data = { Status: { Call: [{ id: 42, Status: 'Connected' }] } };

      feedback.on('Status/Call/Status', spy);
      feedback.dispatch(data);

      expect(spy).to.have.been.calledWith('Connected', data);
    });

    it('can listen to lower-case events', () => {
      const spy = sandbox.spy();
      const data = { Status: { Call: [{ id: 42, ghost: 'True' }] } };

      feedback.on('Status/Call/ghost', spy);
      feedback.dispatch(data);

      expect(spy).to.have.been.calledWith('True', data);
    });
  });

  describe('.on()', () => {
    it('registers handler for events', () => {
      const spy = sandbox.spy();

      feedback.on('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).to.have.been.calledWith(50);
    });

    it('returns handler for disabling feedback', () => {
      const spy = sandbox.spy();

      const handler = feedback.on('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).to.have.been.calledWith(50);
      spy.resetHistory();

      handler();

      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });
      expect(spy).to.not.have.been.called();
    });

    it('registers feedback with the backend', () => {
      const path = 'Status/Audio/Volume';

      feedback.on(path, () => {});

      expect(xapi.execute).to.have.been.calledWith('xFeedback/Subscribe', {
        Query: ['Status', 'Audio', 'Volume'],
      });
    });

    it('cancelling double registration leaves one listener', () => {
      const spy = sandbox.spy();
      const path = 'Status/Audio/Volume';

      feedback.on(path, spy);
      const off = feedback.on(path, spy);
      off();

      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).to.have.been.calledOnce();
      expect(spy).to.have.been.calledWith(50);
    });

    it('normalizes path', () => {
      const path = 'status/audio   volume';

      feedback.on(path, () => {});

      expect(xapi.execute).to.have.been.calledWith('xFeedback/Subscribe', {
        Query: ['Status', 'Audio', 'Volume'],
      });
    });

    it('can dispatch to normalized path', () => {
      const spy = sandbox.spy();

      feedback.on('status/audio   volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy.firstCall).to.have.been.calledWith(50);
    });

    it('can use crazy casing', () => {
      const spy = sandbox.spy();

      feedback.on('fOO Bar BaZ', spy);
      feedback.dispatch({ Foo: { Bar: { Baz: 50 } } });

      expect(spy.firstCall).to.have.been.calledWith(50);
    });

    it('handles arrays', () => {
      const spy1 = sandbox.spy();
      const spy2 = sandbox.spy();
      const spy3 = sandbox.spy();
      const spy4 = sandbox.spy();

      feedback.on('Status/Peripherals/ConnectedDevice/Status', spy1);
      feedback.on('Status/Peripherals/ConnectedDevice[]/Status', spy2);
      feedback.on('Status/Peripherals/ConnectedDevice/1115/Status', spy3);
      feedback.on('Status/Peripherals/ConnectedDevice[1115]/Status', spy4);
      feedback.dispatch({
        Status: {
          Peripherals: {
            ConnectedDevice: [
              { id: '1115', Status: 'LostConnection' },
              { id: '1020', Status: 'Connected' },
            ],
          },
        },
      });

      expect(spy1).to.have.been.calledTwice();
      expect(spy1).to.have.been.calledWith('LostConnection');
      expect(spy1).to.have.been.calledWith('Connected');

      expect(spy2).to.have.been.calledTwice();
      expect(spy2).to.have.been.calledWith('LostConnection');
      expect(spy2).to.have.been.calledWith('Connected');

      expect(spy3).to.have.been.calledOnce();
      expect(spy3).to.have.been.calledWith('LostConnection');
      expect(spy3).to.not.have.been.calledWith('Connected');

      expect(spy4).to.have.been.calledOnce();
      expect(spy4).to.have.been.calledWith('LostConnection');
      expect(spy4).to.not.have.been.calledWith('Connected');
    });

    it('dispatches array elements one-by-one', () => {
      const spy = sinon.spy();

      feedback.on('foo/bar', spy);

      feedback.dispatch({
        foo: { bar: [{ baz: 'quux' }] },
      });

      expect(spy).to.have.been.calledOnce();
      expect(spy).to.have.been.calledWith({ baz: 'quux' });
    });

    it('handles ghost events', () => {
      const spy = sandbox.spy();

      feedback.on('Status/Peripherals/ConnectedDevice', spy);
      feedback.dispatch({
        Status: {
          Peripherals: {
            ConnectedDevice: [
              {
                id: '1115',
                ghost: 'True',
              },
            ],
          },
        },
      });

      expect(spy.firstCall).to.have.been.calledWith({
        id: '1115',
        ghost: 'True',
      });
    });

    it('is called by .once()', () => {
      const path = 'Status/Audio/Volume';
      const listener = () => {};

      sandbox.spy(feedback, 'on');
      feedback.once(path, listener);

      const [callPath, callListener] = feedback.on.firstCall.args;

      expect(callPath).to.equal(path);
      expect(callListener.listener).to.equal(listener);
    });
  });

  describe('.once()', () => {
    it('deregisters after emit', () => {
      const spy = sandbox.spy();

      feedback.once('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });
      feedback.dispatch({ Status: { Audio: { Volume: '70' } } });

      expect(spy).to.have.been.calledWith('50');
      expect(spy).to.not.have.been.calledWith('70');
    });
  });

  describe('.off()', () => {
    it('is now deprecated/removed and throws Error', () => {
      const spy = sandbox.spy();
      const path = 'Status/Audio/Volume';

      feedback.on(path, spy);

      const off = () => {
        feedback.off(path, spy);
      };

      expect(off).to.throw(Error, /deprecated/);
    });
  });

  describe('interceptor', () => {
    beforeEach(() => {
      interceptor.reset();
    });

    it('can reject feedback', () => {
      const volumeSpy = sandbox.spy();
      const data = { Status: { Audio: { Volume: '50' } } };

      interceptor.onFirstCall().callsFake(() => {});
      interceptor.onSecondCall().callsArg(1);

      feedback.on('Status Audio Volume', volumeSpy);

      feedback.dispatch(data);
      expect(volumeSpy).to.not.have.been.called();

      feedback.dispatch(data);
      expect(volumeSpy).to.have.been.calledOnce();
      expect(volumeSpy).to.have.been.calledWith('50', data);
    });

    it('can change the data', () => {
      const spy = sandbox.spy();

      interceptor.callsFake((data, dispatch) => {
        const item = getPath(data, 'Status', 'Audio', 'Volume');
        if (item) {
          // eslint-disable-next-line no-param-reassign
          data.Status.Audio.Volume = '100';
          dispatch(data);
        }
      });

      feedback.on('Status Audio Volume', spy);

      const data = { Status: { Audio: { Volume: '50' } } };
      feedback.dispatch(data);

      expect(spy).to.have.been.calledOnce();
      expect(spy).to.have.been.calledWith('100', data);
    });
  });

  describe('.group()', () => {
    let group;
    let muteSpy;
    let volumeSpy;

    beforeEach(() => {
      muteSpy = sandbox.spy();
      volumeSpy = sandbox.spy();
      group = feedback.group([
        xapi.status.on('Audio/Volume', volumeSpy),
        xapi.status.on('Audio/VolumeMute', muteSpy),
      ]);
    });

    it('can register and dispatch as normal', () => {
      feedback.dispatch({
        Status: {
          Audio: {
            Volume: '50',
            VolumeMute: 'On',
          },
        },
      });

      expect(volumeSpy.firstCall).to.have.been.calledWith('50');
      expect(muteSpy.firstCall).to.have.been.calledWith('On');
    });

    it('only deregisters feedback of the group', () => {
      const rootSpy = sandbox.spy();
      xapi.status.on('Audio/Volume', rootSpy);

      group.off();

      feedback.dispatch({
        Status: {
          Audio: {
            Volume: '50',
            VolumeMute: 'On',
          },
        },
      });

      expect(rootSpy.firstCall).to.have.been.calledWith('50');
      expect(volumeSpy).to.not.have.been.called();
      expect(muteSpy).to.not.have.been.called();
    });

    it('supports .once()', () => {
      const spy = sandbox.spy();

      group.off();
      group.add(xapi.status.once('Audio/Volume', spy));

      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });
      feedback.dispatch({ Status: { Audio: { Volume: '70' } } });

      expect(spy).to.have.been.calledOnce();
      expect(spy.firstCall).to.have.been.calledWith('50');
    });

    it('can clean up .once() before emit with .off()', () => {
      const spy = sandbox.spy();

      group.add(xapi.status.once('Status/Audio/Volume', spy));
      group.off();

      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });

      expect(spy).to.not.have.been.called();
    });
  });
});
