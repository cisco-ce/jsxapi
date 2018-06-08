import Backend from '../../src/backend';
import XAPI from '../../src/xapi';

describe('XAPI', () => {
  let backend;
  let sandbox;
  let xapi;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('events', () => {
    beforeEach(() => {
      backend = new Backend();
      xapi = new XAPI(backend);
    });

    it('emits "ready" when backend is ready', () => {
      const readySpy = sandbox.spy();

      xapi.on('ready', readySpy);

      backend.emit('ready');

      expect(readySpy).to.have.been.calledOnce();
    });

    it('emits "error" on backend error', () => {
      const error = new Error('some error');
      const errorSpy = sandbox.spy();

      xapi.on('error', errorSpy);

      backend.emit('error', error);

      expect(errorSpy).to.have.been.calledOnce();
      expect(errorSpy.firstCall).to.have.been.calledWith(error);
    });

    it('emits "close" on backend close', () => {
      const closeSpy = sandbox.spy();

      xapi.on('close', closeSpy);

      backend.emit('close');

      expect(closeSpy).to.have.been.calledOnce();
    });
  });

  describe('.feedback', () => {
    beforeEach(() => {
      backend = new Backend();
      xapi = new XAPI(backend);
    });

    it('property is enumerable', () => {
      const index = Object.keys(xapi).indexOf('feedback');
      expect(index).to.not.equal(-1);
    });

    it('property is not writable', () => {
      const fn = () => {
        xapi.feedback = {};
      };
      expect(fn).to.throw(TypeError);
    });

    it('is dispatched to feedback handler', () => {
      const stub = sandbox.stub(xapi.feedback, 'dispatch');
      const params = { Status: { Audio: { Volume: 50 } } };

      backend.emit('data', {
        jsonrpc: '2.0',
        method: 'xFeedback/Event',
        params,
      });

      expect(stub).to.have.been.calledWith(params);
    });
  });

  describe('.execute()', () => {
    beforeEach(() => {
      backend = new Backend();
      xapi = new XAPI(backend);
    });

    const asyncResponse = (backend_, response) => (request) => {
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
      }, 0);
    };

    it('returns a Promise object', () => {
      sandbox.stub(backend, 'execute');

      const result = xapi.execute('xCommand/Dial', {
        Number: 'user@example.com',
      });

      expect(result).to.be.an.instanceof(Promise);
    });

    it('resolves promise when backend emits success response', () => {
      sandbox.stub(backend, 'execute').callsFake(
        asyncResponse(backend, {
          result: {
            CallId: 3,
            ConferenceId: 2,
          },
        }),
      );

      const result = xapi.execute('xCommand/Dial', {
        Number: 'user@example.com',
      });

      return expect(result).to.eventually.deep.equal({
        CallId: 3,
        ConferenceId: 2,
      });
    });

    it('rejects promise when backend emits error response', () => {
      sandbox.stub(backend, 'execute').callsFake(
        asyncResponse(backend, {
          error: {
            code: XAPI.METHOD_NOT_FOUND,
            message: 'Unknown command',
          },
        }),
      );

      const result = xapi.execute('xCommand/Foo/Bar', { Baz: 'quux' });

      return expect(result).to.eventually.be.rejectedWith('Unknown command');
    });
  });

  describe('Components', () => {
    let execStub;

    beforeEach(() => {
      execStub = sandbox.spy(XAPI.prototype, 'execute');

      backend = new Backend();
      xapi = new XAPI(backend);

      sandbox.stub(backend, 'execute');
    });

    describe('.command()', () => {
      it('invokes and returns .execute()', () => {
        const result = xapi.command('Dial', { Number: 'user@example.com' });
        const call = execStub.firstCall;

        expect(call).to.have.been.calledWith('xCommand/Dial', {
          Number: 'user@example.com',
        });

        expect(call.returnValue).to.equal(result);
      });

      it('converts Array path to json-rpc method string', () => {
        xapi.command(['Presentation', 'Start'], { PresentationSource: 1 });

        expect(execStub).to.have.been.calledWith(
          'xCommand/Presentation/Start',
          {
            PresentationSource: 1,
          },
        );
      });

      it('accepts whitespace delimited command paths', () => {
        xapi.command('Foo Bar\n  Baz \t');

        expect(execStub).to.have.been.calledWith(
          'xCommand/Foo/Bar/Baz',
          undefined,
        );
      });

      it('rejects newline in regular params', () => {
        const result = xapi.command('UserInterface Message Echo', {
          Text: 'foo \n bar \n',
        });

        return expect(result).to.eventually.be.rejectedWith(
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

        expect(execStub).to.have.been.calledWith(
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
          const call = execStub.firstCall;

          expect(call).to.have.been.calledWith('xGet', {
            Path: ['Configuration', 'Audio', 'DefaultVolume'],
          });

          expect(call.returnValue).to.equal(result);
        });
      });

      describe('.set()', () => {
        it('invokes and returns xapi.execute', () => {
          const result = xapi.config.set('Audio DefaultVolume', 100);
          const call = execStub.firstCall;

          expect(call).to.have.been.calledWith('xSet', {
            Path: ['Configuration', 'Audio', 'DefaultVolume'],
            Value: 100,
          });

          expect(call.returnValue).to.equal(result);
        });
      });
    });

    describe('.event', () => {
      describe('.on()', () => {
        it('registers feedback with feedback handler', () => {
          const handler = sandbox.spy();
          xapi.event.on('Standby', handler);

          xapi.feedback.dispatch({ Event: { Standby: 'Active' } });

          expect(handler).to.have.been.calledOnce();
          expect(handler.firstCall).to.have.been.calledWith('Active');
        });
      });

      describe('.off()', () => {
        it('can de-register feedback', () => {
          const handler = sandbox.spy();
          const off = xapi.event.on('Standby', handler);

          xapi.feedback.dispatch({ Event: { Standby: 'Active' } });
          off();
          xapi.feedback.dispatch({ Event: { Standby: 'Deactive' } });

          expect(handler).to.have.been.calledOnce();
          expect(handler).to.have.been.calledWith('Active');
        });
      });
    });

    describe('.status', () => {
      describe('.get()', () => {
        it('invokes and returns xapi.execute', () => {
          const result = xapi.status.get('Audio Volume');
          const call = execStub.firstCall;

          expect(call).to.have.been.calledWith('xGet', {
            Path: ['Status', 'Audio', 'Volume'],
          });

          expect(call.returnValue).to.equal(result);
        });
      });
    });
  });
});
