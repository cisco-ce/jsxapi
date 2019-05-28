import { Duplex, DuplexOptions } from 'stream';

/**
 * Duplex stream transport for integrations where JSXAPI does not have direct
 * access to the network or local ipc. E.g. for sandboxing or test stubs.
 */
export default class StreamTransport extends Duplex {
  private buffer: string[] = [];
  private canPush = false;
  /**
   * Creates a {@link Duplex} stream.
   *
   * @param {function(data: string)} send - Callback for outbound data
   * @return {Duplex} - Duplex stream.
   */
  constructor(readonly send: any, options?: DuplexOptions) {
    super(options);
    this.on('finish', () => {
      this.emit('close');
    });
  }

  /**
   * @param {string} data - Push inbound data from the XAPI service to JSXAPI.
   * @return {boolean} - Boolean signaling if the stream can receive more data.
   */
  public push(data: string) {
    this.buffer.push(data);
    return this.attemptFlush();
  }

  public _read() {
    this.canPush = true;
    this.attemptFlush();
  }

  public _write(chunk: any, encoding: string, callback: any) {
    this.send(chunk, encoding, callback);
  }

  /**
   * Closes the stream transport
   */
  public close() {
    this.end();
  }

  private attemptFlush() {
    while (this.canPush && this.buffer.length) {
      this.canPush = super.push(this.buffer.shift());
    }
    return this.canPush;
  }
}
