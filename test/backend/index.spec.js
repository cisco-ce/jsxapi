import Backend from '../../src/backend';
import { XAPIError } from '../../src/xapi/exc';


describe('Backend', () => {
  let backend;
  let sandbox;

  beforeEach(() => {
    backend = new Backend();
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('.defaultHandler()', () => {
    it('returns a rejected promise', () => {
      const result = backend.defaultHandler({
        method: 'xCommand/Dial',
        params: { Number: 'user@example.com' },
      });

      return expect(result).to.eventually.be.rejectedWith('Invalid request method');
    });
  });

  describe('.execute()', () => {
    it('calls .defaultHandler() when no handlers exist', (done) => {
      const request = {
        method: 'xCommand/Dial',
        params: { Number: 'user@example.com' },
      };

      sandbox.stub(backend, 'defaultHandler').callsFake((actual) => {
        expect(actual).to.deep.equal(request);
        done();
      });

      backend.execute(request);
    });

    it('handler can return plain values', (done) => {
      backend['xCommand()'] = () => 42;

      backend.on('data', (result) => {
        expect(result).to.deep.equal({
          jsonrpc: '2.0',
          id: 'request-1',
          result: 42,
        });
        done();
      });

      backend.execute({
        jsonrpc: '2.0',
        id: 'request-1',
        method: 'xCommand/Foo',
        params: { Bar: 'Baz' },
      });
    });

    const testCases = [{
      name: 'xCommand',
      method: 'xCommand/Dial',
      params: { Number: 'user@example.com' },
    }, {
      name: 'xFeedback/Subscribe',
      method: 'xFeedback/Subscribe',
      params: { Query: ['Status', 'Audio', 'Volume'] },
    }, {
      name: 'xFeedback/Unsubscribe',
      method: 'xFeedback/Unsubscribe',
      params: { Id: 1 },
    }, {
      name: 'xGet',
      method: 'xGet',
      params: { Path: ['Status', 'Audio', 'Volume'] },
    }, {
      name: 'xSet',
      method: 'xSet',
      params: {
        Path: ['Configuration', 'Audio', 'DefaultVolume'],
        Value: 50,
      },
    }];

    testCases.forEach(({ name, method, params }) => {
      it(`calls .${name}() handler`, () => {
        const send = sandbox.stub(backend, 'send');
        const handler = sandbox.spy((r, _send) => _send());
        const request = { jsonrpc: '2.0', id: 'request-1', method, params };

        backend[`${name}()`] = handler;
        backend.execute(request);

        expect(handler).to.not.have.been.called();
        expect(send).to.not.have.been.called();

        return backend.isReady.then(() => {
          expect(handler.firstCall).to.have.been.calledWith(request);
          expect(send.firstCall).to.have.been.calledWith('request-1');
        });
      });
    });

    it('handles error', (done) => {
      const send = sandbox.stub(backend, 'send');
      backend['xCommand()'] = sandbox.spy((r, _send) => _send());
      send.throws(new XAPIError(0, 'Some XAPI thing went wrong'));

      backend.on('data', (data) => {
        expect(data).to.have.properties({
          error: {
            code: 0,
            message: 'Some XAPI thing went wrong',
          },
        });
        done();
      });

      backend.execute({ jsonrpc: '2.0', id: 'request', method: 'xCommand/Foo/Bar' });
    });
  });
});
