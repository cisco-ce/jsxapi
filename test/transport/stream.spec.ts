import StreamTransport from '../../src/transport/stream';

describe('StreamTransport', () => {
  it('can push before listening', (done) => {
    const stream = new StreamTransport(null);

    stream.push('foo bar baz');

    stream.on('data', (data) => {
      expect(data.toString()).toEqual('foo bar baz');
      done();
    });
  });

  it('can push after listening', (done) => {
    const stream = new StreamTransport(null);

    stream.on('data', (data) => {
      expect(data.toString()).toEqual('foo bar baz');
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
