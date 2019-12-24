import Backend from '../../src/backend';
import XAPI from '../../src/xapi';
import Feedback, { FeedbackGroup } from '../../src/xapi/feedback';

function getPath(obj: any, ...path: any[]) {
  let tmp = obj;

  while (typeof tmp === 'object' && path.length) {
    const key = path.shift();
    tmp = tmp[key];
  }

  return tmp;
}

describe('Feedback', () => {
  let interceptor: jest.SpyInstance;
  let feedback: Feedback;
  let xapi: XAPI;
  let executeStub: jest.SpyInstance;

  beforeEach(() => {
    interceptor = jest.fn().mockImplementation((_, fn) => {
      fn();
    });
    xapi = new XAPI(new Backend(), {
      feedbackInterceptor: interceptor,
      seal: true,
    } as any);
    ({ feedback } = xapi);

    let nextSubscriptionId = 0;
    executeStub = jest
      .spyOn(XAPI.prototype, 'execute')
      .mockImplementation((method) => {
        switch (method) {
          case 'xFeedback/Subscribe': {
            const id = nextSubscriptionId;
            nextSubscriptionId += 1;
            return Promise.resolve({ Id: id });
          }
          default:
            return Promise.resolve({ Id: 52 });
        }
      });
  });

  afterEach(() => {
    executeStub.mockRestore();
  });

  it('is instance of Feedback', () => {
    expect(feedback).toBeInstanceOf(Feedback);
  });

  describe('.dispatch()', () => {
    it('returns this', () => {
      expect(feedback.dispatch({ Status: 'foo' })).toEqual(feedback);
    });

    it('fires event', () => {
      const spy = jest.fn();
      feedback.on('Status', spy);
      feedback.dispatch({ Status: 'foo' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('foo', expect.anything());
    });

    it('fires events recursively', () => {
      const data = { Status: { Audio: { Volume: '50' } } };
      const spies = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];

      feedback.on('', spies[0]);
      feedback.on('Status', spies[1]);
      feedback.on('Status/Audio', spies[2]);
      feedback.on('Status/Audio/Volume', spies[3]);
      feedback.dispatch(data);

      [data, data.Status, data.Status.Audio, data.Status.Audio.Volume].forEach(
        (d, i) => {
          expect(spies[i]).toHaveBeenNthCalledWith(1, d, expect.anything());
        },
      );
    });

    it('does not invoke unrelated handlers', () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      feedback.on('Status/Audio/Volume', spy1);
      feedback.on('Status/Audio/VolumeMute', spy2);
      feedback.dispatch({ Status: { Audio: { VolumeMute: 'off' } } });

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledWith('off', expect.anything());
    });

    it('dispatches original feedback payload as second argument', () => {
      const spy = jest.fn();
      const data = { Status: { Call: [{ id: 42, Status: 'Connected' }] } };

      feedback.on('Status/Call/Status', spy);
      feedback.dispatch(data);

      expect(spy).toHaveBeenCalledWith('Connected', data);
    });

    it('can listen to lower-case events', () => {
      const spy = jest.fn();
      const data = { Status: { Call: [{ id: 42, ghost: 'True' }] } };

      feedback.on('Status/Call/ghost', spy);
      feedback.dispatch(data);

      expect(spy).toHaveBeenCalledWith('True', data);
    });
  });

  describe('.on()', () => {
    it('registers handler for events', () => {
      const spy = jest.fn();

      feedback.on('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenCalledWith(50, expect.anything());
    });

    it('returns handler for disabling feedback', () => {
      const spy = jest.fn();

      const handler = feedback.on('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenCalledWith(50, expect.anything());
      spy.mockClear();

      handler();

      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });
      expect(spy).not.toHaveBeenCalled();
    });

    it('off handler contains registration promise', async () => {
      const spy = jest.fn();

      const regs = await Promise.all([
        feedback.on('Status/Audio/Volume', spy).registration,
        feedback.on('Status/Audio/Volume', spy).registration,
      ]);

      expect(regs).toEqual([{ Id: 0 }, { Id: 1 }]);
    });

    it('registers feedback with the backend', () => {
      const path = 'Status/Audio/Volume';

      feedback.on(path, () => {});

      expect(xapi.execute).toHaveBeenCalledWith('xFeedback/Subscribe', {
        Query: ['Status', 'Audio', 'Volume'],
      });
    });

    it('cancelling double registration leaves one listener', () => {
      const spy = jest.fn();
      const path = 'Status/Audio/Volume';

      feedback.on(path, spy);
      const off = feedback.on(path, spy);
      off();

      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(50, expect.anything());
    });

    it('normalizes path', () => {
      const path = 'status/audio   volume';

      feedback.on(path, () => {});

      expect(xapi.execute).toHaveBeenCalledWith('xFeedback/Subscribe', {
        Query: ['Status', 'Audio', 'Volume'],
      });
    });

    it('can dispatch to normalized path', () => {
      const spy = jest.fn();

      feedback.on('status/audio   volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenNthCalledWith(1, 50, expect.anything());
    });

    it('can use crazy casing', () => {
      const spy = jest.fn();

      feedback.on('fOO Bar BaZ', spy);
      feedback.dispatch({ Foo: { Bar: { Baz: 50 } } });

      expect(spy).toHaveBeenNthCalledWith(1, 50, expect.anything());
    });

    it('handles arrays', () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();
      const spy3 = jest.fn();
      const spy4 = jest.fn();

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

      expect(spy1).toHaveBeenNthCalledWith(1, 'LostConnection', expect.anything());
      expect(spy1).toHaveBeenNthCalledWith(2, 'Connected', expect.anything());

      expect(spy2).toHaveBeenNthCalledWith(1, 'LostConnection', expect.anything());
      expect(spy2).toHaveBeenNthCalledWith(2, 'Connected', expect.anything());

      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledWith('LostConnection', expect.anything());
      expect(spy3).not.toHaveBeenCalledWith('Connected', expect.anything());

      expect(spy4).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledWith('LostConnection', expect.anything());
      expect(spy4).not.toHaveBeenCalledWith('Connected', expect.anything());
    });

    it('dispatches array elements one-by-one', () => {
      const spy = jest.fn();

      feedback.on('foo/bar', spy);

      feedback.dispatch({
        foo: { bar: [{ baz: 'quux' }] },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ baz: 'quux' }, expect.anything());
    });

    it('handles ghost events', () => {
      const spy = jest.fn();

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

      expect(spy).toHaveBeenNthCalledWith(
        1,
        {
          id: '1115',
          ghost: 'True',
        },
        expect.anything(),
      );
    });

    it('is called by .once()', () => {
      const path = 'Status/Audio/Volume';
      const listener = () => {};

      const spy = jest.spyOn(feedback, 'on');
      feedback.once(path, listener);

      const [callPath, callListener] = spy.mock.calls[0];

      expect(callPath).toEqual(path);
      expect((callListener as any).listener).toEqual(listener);
    });
  });

  describe('.once()', () => {
    it('deregisters after emit', () => {
      const spy = jest.fn();

      feedback.once('Status/Audio/Volume', spy);
      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });
      feedback.dispatch({ Status: { Audio: { Volume: '70' } } });

      expect(spy).toHaveBeenCalledWith('50', expect.anything());
      expect(spy).not.toHaveBeenCalledWith('70', expect.anything());
    });
  });

  describe('.off()', () => {
    it('is now deprecated/removed and throws Error', () => {
      const spy = jest.fn();
      const path = 'Status/Audio/Volume';

      feedback.on(path, spy);

      const off = () => {
        feedback.off();
      };

      expect(off).toThrow(/deprecated/);
    });
  });

  describe('interceptor', () => {
    beforeEach(() => {
      interceptor.mockReset();
    });

    it('can reject feedback', () => {
      const volumeSpy = jest.fn();
      const data = { Status: { Audio: { Volume: '50' } } };

      interceptor
        .mockImplementationOnce(() => {})
        .mockImplementationOnce((_, fn) => {
          fn();
        });

      feedback.on('Status Audio Volume', volumeSpy);

      feedback.dispatch(data);
      expect(volumeSpy).not.toHaveBeenCalled();

      feedback.dispatch(data);
      expect(volumeSpy).toHaveBeenCalledTimes(1);
      expect(volumeSpy).toHaveBeenCalledWith('50', data);
    });

    it('can change the data', () => {
      const spy = jest.fn();

      interceptor.mockImplementation(
        (data: any, dispatch: (d: any) => void) => {
          const item = getPath(data, 'Status', 'Audio', 'Volume');
          if (item) {
            data.Status.Audio.Volume = '100';
            dispatch(data);
          }
        },
      );

      feedback.on('Status Audio Volume', spy);

      const data = { Status: { Audio: { Volume: '50' } } };
      feedback.dispatch(data);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('100', data);
    });
  });

  describe('.group()', () => {
    let group: FeedbackGroup;
    let muteSpy: jest.Mock;
    let volumeSpy: jest.Mock;

    beforeEach(() => {
      muteSpy = jest.fn();
      volumeSpy = jest.fn();
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

      expect(volumeSpy).toHaveBeenNthCalledWith(1, '50', expect.anything());
      expect(muteSpy).toHaveBeenNthCalledWith(1, 'On', expect.anything());
    });

    it('only deregisters feedback of the group', () => {
      const rootSpy = jest.fn();
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

      expect(rootSpy).toHaveBeenNthCalledWith(1, '50', expect.anything());
      expect(volumeSpy).not.toHaveBeenCalled();
      expect(muteSpy).not.toHaveBeenCalled();
    });

    it('supports .once()', () => {
      const spy = jest.fn();

      group.off();
      group.add(xapi.status.once('Audio/Volume', spy));

      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });
      feedback.dispatch({ Status: { Audio: { Volume: '70' } } });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('50', expect.anything());
    });

    it('can clean up .once() before emit with .off()', () => {
      const spy = jest.fn();

      group.add(xapi.status.once('Status/Audio/Volume', spy));
      group.off();

      feedback.dispatch({ Status: { Audio: { Volume: '50' } } });

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
