import { Duplex } from 'stream';


/**
 * Duplex stream transport for integrations where JSXAPI does not have direct
 * access to the network or local ipc. E.g. for sandboxing or test stubs.
 */
export default class StreamTransport extends Duplex {
  /**
   * Creates a {@link Duplex} stream.
   *
   * @param {function(data: string)} send - Callback for outbound data
   * @return {Duplex} - Duplex stream.
   */
  constructor(send, options) {
    super(options);
    this.buffer = [];
    this.canPush = false;
    this.send = send;
    this.on('finish', () => { this.emit('close'); });
  }

  /**
   * Closes the stream transport
   */
  close() {
    this.end();
  }

  /**
   * @param {string} data - Push inbound data from the XAPI service to JSXAPI.
   * @return {boolean} - Boolean signaling if the stream can receive more data.
   */
  push(data) {
    this.buffer.push(data);
    return this.attemptFlush();
  }

  attemptFlush() {
    while (this.canPush && this.buffer.length) {
      this.canPush = super.push(this.buffer.shift());
    }
    return this.canPush;
  }

  _read() {
    this.canPush = true;
    this.attemptFlush();
  }

  _write(chunk, encoding, callback) {
    this.send(chunk, encoding, callback);
  }
}
