import Backend from '../../src/backend';
import XAPI from '../../src/xapi';
import { XapiRequest, XapiResult } from '../../src/xapi/types';
import { METHOD_NOT_FOUND } from '../../src/xapi/exc';

describe('XAPI', () => {
  let backend: Backend;
  let xapi: XAPI;

  beforeEach(() => {
    backend = new Backend();
    xapi = new XAPI(backend);
  });

  describe('property is not writable', () => {
    const props = [
      'command',
      'Command',
      'config',
      'Config',
      'event',
      'Event',
      'feedback',
      'status',
      'Status',
    ];
    props.forEach((prop) => {
      it(prop, () => {
        const fn = () => {
          (xapi as any)[prop] = {};
        };
        expect(fn).toThrow(TypeError);
      });
    });
  });

  describe('events', () => {
    it('emits "ready" when backend is ready', () => {
      const readySpy = jest.fn();

      xapi.on('ready', readySpy);

      backend.emit('ready');

      expect(readySpy).toHaveBeenCalledTimes(1);
      expect(readySpy).toHaveBeenCalledWith(xapi);
    });

    it('emits "error" on backend error', () => {
      const error = new Error('some error');
      const errorSpy = jest.fn();

      xapi.on('error', errorSpy);

      backend.emit('error', error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('emits "close" on backend close', () => {
      const closeSpy = jest.fn();

      xapi.on('close', closeSpy);

      backend.emit('close');

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('.feedback', () => {
    it('property is enumerable', () => {
      expect(Object.keys(xapi)).toContain('feedback');
    });

    it('property is not writable', () => {
      const fn = () => {
        xapi.feedback = {} as any;
      };
      expect(fn).toThrow(TypeError);
    });

    it('is dispatched to feedback handler', () => {
      const stub = jest.spyOn(xapi.feedback, 'dispatch').mockImplementation(function () { return this; });
      const params = { Status: { Audio: { Volume: 50 } } };

      backend.emit('data', {
        jsonrpc: '2.0',
        method: 'xFeedback/Event',
        params,
      });

      expect(stub).toHaveBeenCalledWith(params);
    });
  });

  describe('.execute()', () => {
    beforeEach(() => {
      backend = new Backend();
      xapi = new XAPI(backend);
    });

    type Response = {
      result: any;
    } | {
      error: {
        code: any;
        message: string;
      }
    };

    const asyncResponse = (backend_: Backend, response: Response) => (request: XapiRequest) => {
      return new Promise<void>(resolve => {
        setTimeout(() => {
          backend_.emit(
            'data',
            Object.assign(
              {
                jsonrpc: '2.0',
                id: request.id,
              },
              response,
            ),
          );
          resolve();
        }, 0);
      });
    };

    it('returns a Promise object', () => {
      jest.spyOn(backend, 'execute').mockResolvedValue(undefined);

      const result = xapi.execute('xCommand/Dial', {
        Number: 'user@example.com',
      });

      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves promise when backend emits success response', async () => {
      jest.spyOn(backend, 'execute').mockImplementation(
        asyncResponse(backend, {
          result: {
            CallId: 3,
            ConferenceId: 2,
          },
        }),
      );

      const result = await xapi.execute('xCommand/Dial', {
        Number: 'user@example.com',
      });

      expect(result).toEqual({
        CallId: 3,
        ConferenceId: 2,
      });
    });

    it('rejects promise when backend emits error response', () => {
      jest.spyOn(backend, 'execute').mockImplementation(
        asyncResponse(backend, {
          error: {
            code: METHOD_NOT_FOUND,
            message: 'Unknown command',
          },
        }),
      );

      const result = xapi.execute('xCommand/Foo/Bar', { Baz: 'quux' });

      return expect(result).rejects.toMatchObject({ message: 'Unknown command' });
    });
  });

  describe('Components', () => {
    let execStub: jest.SpyInstance;

    beforeEach(() => {
      execStub = jest.spyOn(XAPI.prototype, 'execute');
      jest.spyOn(backend, 'execute').mockResolvedValue(undefined);
    });

    afterEach(() => {
      execStub.mockRestore();
    })

    describe('.command()', () => {
      it('invokes and returns .execute()', () => {
        const result = xapi.command('Dial', { Number: 'user@example.com' });

        expect(execStub).toHaveBeenCalledTimes(1);
        expect(execStub).toHaveBeenCalledWith('xCommand/Dial', {
          Number: 'user@example.com',
        });

        expect(execStub).toHaveNthReturnedWith(1, result);
      });

      it('converts Array path to json-rpc method string', () => {
        xapi.command(['Presentation', 'Start'], { PresentationSource: 1 });

        expect(execStub).toHaveBeenCalledWith(
          'xCommand/Presentation/Start',
          {
            PresentationSource: 1,
          },
        );
      });

      it('accepts whitespace delimited command paths', () => {
        xapi.command('Foo Bar\n  Baz \t');

        expect(execStub).toHaveBeenCalledWith(
          'xCommand/Foo/Bar/Baz',
          undefined,
        );
      });

      it('rejects newline in regular params', () => {
        const result = xapi.command('UserInterface Message Echo', {
          Text: 'foo \n bar \n',
        });

        return expect(result).rejects.toThrow(
          /may not contain newline/,
        );
      });

      it('supports multi-line commands using the third parameter', () => {
        const body = `
          <Extensions>
            <Version>1.1</Version>
            <Panel item="1" maxOccurrence="n">
              <Icon>Lightbulb</Icon>
              <Type>Statusbar</Type>
              <Page item="1" maxOccurrence="n">
                <Name>Foo</Name>
                <Row item="1" maxOccurrence="n">
                  <Name>Bar</Name>
                  <Widget item="1" maxOccurrence="n">
                    <WidgetId>widget_3</WidgetId>
                    <Type>ToggleButton</Type>
                  </Widget>
                </Row>
                <Row item="2" maxOccurrence="n">
                  <Name>asdf</Name>
                </Row>
              </Page>
            </Panel>
          </Extensions>
        `;

        xapi.command(
          'UserInterface Extensions Set',
          { ConfigId: 'example' },
          body,
        );

        expect(execStub).toHaveBeenCalledWith(
          'xCommand/UserInterface/Extensions/Set',
          {
            ConfigId: 'example',
            body,
          },
        );
      });
    });

    describe('.config', () => {
      describe('.get()', () => {
        it('invokes and returns xapi.execute', () => {
          const result = xapi.config.get('Audio DefaultVolume');

          expect(execStub).toHaveBeenCalledTimes(1);
          expect(execStub).toHaveBeenCalledWith('xGet', {
            Path: ['Configuration', 'Audio', 'DefaultVolume'],
          });

          expect(execStub).toHaveNthReturnedWith(1, result);
        });
      });

      describe('.set()', () => {
        it('invokes and returns xapi.execute', () => {
          const result = xapi.config.set('Audio DefaultVolume', 100);

          expect(execStub).toHaveBeenCalledTimes(1);
          expect(execStub).toHaveBeenCalledWith('xSet', {
            Path: ['Configuration', 'Audio', 'DefaultVolume'],
            Value: 100,
          });

          expect(execStub).toHaveNthReturnedWith(1, result);
        });
      });
    });

    describe('.event', () => {
      describe('.on()', () => {
        it('registers feedback with feedback handler', () => {
          const handler = jest.fn();
          xapi.event.on('Standby', handler);

          xapi.feedback.dispatch({ Event: { Standby: 'Active' } });

          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith('Active', expect.anything());
        });
      });

      describe('.off()', () => {
        it('can de-register feedback', () => {
          const handler = jest.fn();
          const off = xapi.event.on('Standby', handler);

          xapi.feedback.dispatch({ Event: { Standby: 'Active' } });
          off();
          xapi.feedback.dispatch({ Event: { Standby: 'Deactive' } });

          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith('Active', expect.anything());
        });
      });
    });

    describe('.status', () => {
      describe('.get()', () => {
        it('invokes and returns xapi.execute', () => {
          const result = xapi.status.get('Audio Volume');

          expect(execStub).toHaveBeenCalledTimes(1);
          expect(execStub).toHaveBeenCalledWith('xGet', {
            Path: ['Status', 'Audio', 'Volume'],
          });

          expect(execStub).toHaveNthReturnedWith(1, result);
        });
      });
    });
  });
});
