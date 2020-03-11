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

    it('fires event', async () => {
      const spy = jest.fn();
      await feedback.on('Status', spy).registration;
      feedback.dispatch({ Status: 'foo' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('foo', expect.anything());
    });

    it('fires events recursively', async () => {
      const data = { Status: { Audio: { Volume: '50' } } };
      const spies = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];

      await Promise.all([
        feedback.on('', spies[0]).registration,
        feedback.on('Status', spies[1]).registration,
        feedback.on('Status/Audio', spies[2]).registration,
        feedback.on('Status/Audio/Volume', spies[3]).registration,
      ]);

      feedback.dispatch(data);

      [data, data.Status, data.Status.Audio, data.Status.Audio.Volume].forEach(
        (d, i) => {
          expect(spies[i]).toHaveBeenNthCalledWith(1, d, expect.anything());
        },
      );
    });

    it('does not invoke unrelated handlers', async () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      await Promise.all([
        feedback.on('Status/Audio/Volume', spy1).registration,
        feedback.on('Status/Audio/VolumeMute', spy2).registration,
      ]);

      feedback.dispatch({ Status: { Audio: { VolumeMute: 'off' } } });

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledWith('off', expect.anything());
    });

    it('dispatches original feedback payload as second argument', async () => {
      const spy = jest.fn();
      const data = { Status: { Call: [{ id: 42, Status: 'Connected' }] } };

      await feedback.on('Status/Call/Status', spy).registration;
      feedback.dispatch(data);

      expect(spy).toHaveBeenCalledWith('Connected', data);
    });

    it('can listen to lower-case events', async () => {
      const spy = jest.fn();
      const data = { Status: { Call: [{ id: 42, ghost: 'True' }] } };

      await feedback.on('Status/Call/ghost', spy).registration;
      feedback.dispatch(data);

      expect(spy).toHaveBeenCalledWith('True', data);
    });
  });

  describe('.on()', () => {
    it('registers handler for events', async () => {
      const spy = jest.fn();

      await feedback.on('Status/Audio/Volume', spy).registration;
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenCalledWith(50, expect.anything());
    });

    it('returns handler for disabling feedback', async () => {
      const spy = jest.fn();

      const handler = feedback.on('Status/Audio/Volume', spy);
      await handler.registration;
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

    it('cancelling double registration leaves one listener', async () => {
      const spy = jest.fn();
      const path = 'Status/Audio/Volume';

      await feedback.on(path, spy).registration;
      const off = feedback.on(path, spy);
      await off.registration;
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

    it('can dispatch to normalized path', async () => {
      const spy = jest.fn();

      await feedback.on('status/audio   volume', spy).registration;
      feedback.dispatch({ Status: { Audio: { Volume: 50 } } });

      expect(spy).toHaveBeenNthCalledWith(1, 50, expect.anything());
    });

    it('can use crazy casing', async () => {
      const spy = jest.fn();

      await feedback.on('fOO Bar BaZ', spy).registration;
      feedback.dispatch({ Foo: { Bar: { Baz: 50 } } });

      expect(spy).toHaveBeenNthCalledWith(1, 50, expect.anything());
    });

    it('handles arrays', async () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();
      const spy3 = jest.fn();
      const spy4 = jest.fn();

      await Promise.all([
        feedback.on('Status/Peripherals/ConnectedDevice/Status', spy1).registration,
        feedback.on('Status/Peripherals/ConnectedDevice[]/Status', spy2).registration,
        feedback.on('Status/Peripherals/ConnectedDevice/1115/Status', spy3).registration,
        feedback.on('Status/Peripherals/ConnectedDevice[1115]/Status', spy4).registration,
      ]);

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

    it('dispatches array elements one-by-one', async () => {
      const spy = jest.fn();

      await feedback.on('foo/bar', spy).registration;

      feedback.dispatch({
        foo: { bar: [{ baz: 'quux' }] },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ baz: 'quux' }, expect.anything());
    });

    it('handles ghost events', async () => {
      const spy = jest.fn();

      await feedback
        .on('Status/Peripherals/ConnectedDevice', spy)
        .registration;

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
    it('deregisters after emit', async () => {
      const spy = jest.fn();

      await feedback.once('Status/Audio/Volume', spy).registration;

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

    it('can reject feedback', async () => {
      const volumeSpy = jest.fn();
      const data = { Status: { Audio: { Volume: '50' } } };

      interceptor
        .mockImplementationOnce(() => {})
        .mockImplementationOnce((_, fn) => {
          fn();
        });

      await feedback.on('Status Audio Volume', volumeSpy).registration;

      feedback.dispatch(data);
      expect(volumeSpy).not.toHaveBeenCalled();

      feedback.dispatch(data);
      expect(volumeSpy).toHaveBeenCalledTimes(1);
      expect(volumeSpy).toHaveBeenCalledWith('50', data);
    });

    it('can change the data', async () => {
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

      await feedback.on('Status Audio Volume', spy).registration;

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

    it('only deregisters feedback of the group', async () => {
      const rootSpy = jest.fn();
      await xapi.status.on('Audio/Volume', rootSpy).registration;

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

    it('supports .once()', async () => {
      const spy = jest.fn();

      group.off();

      const subscription = xapi.status.once('Audio/Volume', spy);
      group.add(subscription);

      await subscription.registration;

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
