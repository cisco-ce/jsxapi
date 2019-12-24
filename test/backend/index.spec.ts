import Backend from '../../src/backend';
import { XAPIError } from '../../src/xapi/exc';

describe('Backend', () => {
  let backend: Backend;

  beforeEach(() => {
    backend = new Backend();
  });

  describe('.defaultHandler()', () => {
    it('returns a rejected promise', () => {
      const result = backend.defaultHandler({
        method: 'xCommand/Dial',
        params: { Number: 'user@example.com' },
      });

      return expect(result).rejects.toThrow(
        'Invalid request method',
      );
    });
  });

  describe('.execute()', () => {
    it('calls .defaultHandler() when no handlers exist', (done) => {
      const request = {
        method: 'xCommand/Dial',
        params: { Number: 'user@example.com' },
        jsonrpc: '2.0',
      };

      jest.spyOn(backend, 'defaultHandler').mockImplementation((actual) => {
        expect(actual).toEqual(request);
        done();
        return Promise.resolve();
      });

      backend.execute(request);
    });

    it('handler can return plain values', (done) => {
      (backend as any)['xCommand()'] = () => 42;

      backend.on('data', (result) => {
        expect(result).toEqual({
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

    const testCases = [
      {
        name: 'xCommand',
        method: 'xCommand/Dial',
        params: { Number: 'user@example.com' },
      },
      {
        name: 'xFeedback/Subscribe',
        method: 'xFeedback/Subscribe',
        params: { Query: ['Status', 'Audio', 'Volume'] },
      },
      {
        name: 'xFeedback/Unsubscribe',
        method: 'xFeedback/Unsubscribe',
        params: { Id: 1 },
      },
      {
        name: 'xGet',
        method: 'xGet',
        params: { Path: ['Status', 'Audio', 'Volume'] },
      },
      {
        name: 'xSet',
        method: 'xSet',
        params: {
          Path: ['Configuration', 'Audio', 'DefaultVolume'],
          Value: 50,
        },
      },
    ];

    testCases.forEach(({ name, method, params }) => {
      it(`calls .${name}() handler`, () => {
        const send = jest.spyOn(backend, 'send');
        const handler = jest.fn().mockImplementation((_r, _send) => _send());
        const request = { jsonrpc: '2.0', id: 'request-1', method, params };

        (backend as any)[`${name}()`] = handler;
        backend.execute(request);

        expect(handler).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();

        return backend.isReady.then(() => {
          expect(handler.mock.calls[0]).toContain(request);
          expect(send.mock.calls[0]).toContain('request-1');
        });
      });
    });

    it('handles error', (done) => {
      const send = jest.spyOn(backend, 'send').mockImplementation(() => {
        throw new XAPIError(0, 'Some XAPI thing went wrong')
      });
      (backend as any)['xCommand()'] = jest.fn().mockImplementation((_r, _send) => _send());

      backend.on('data', (data) => {
        expect(data.error).toMatchObject({
          code: 0,
          message: 'Some XAPI thing went wrong',
        });
        done();
      });

      backend.execute({
        jsonrpc: '2.0',
        id: 'request',
        method: 'xCommand/Foo/Bar',
      });
    });
  });
});
