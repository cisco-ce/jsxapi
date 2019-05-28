import { expect } from 'chai';
import * as sinon from 'sinon';
import StreamTransport from '../../src/transport/stream';

describe('StreamTransport', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('can push before listening', (done) => {
    const stream = new StreamTransport(null);

    stream.push('foo bar baz');

    stream.on('data', (data) => {
      expect(data.toString()).to.equal('foo bar baz');
      done();
    });
  });

  it('can push after listening', (done) => {
    const stream = new StreamTransport(null);

    stream.on('data', (data) => {
      expect(data.toString()).to.equal('foo bar baz');
      done();
    });

    stream.push('foo bar baz');
  });

  it('emits close on .close()', (done) => {
    const stream = new StreamTransport(null);

    stream.on('close', () => {
      done();
    });

    stream.close();
  });
});
