import { EventEmitter } from 'events';

/**
 * @external {WebSocket} https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
 */


/**
 * Backend to communicate with a WebSocket server.
 *
 * This backend expects to talk directly to a JSON-RPC WebSocket backend.
 * Authentication has to be handled by the transport layer, there is no
 * support for that on the socket itself.
 *
 * Once the socket is open, it is expected to be in the ready state.
 *
 * @implements {Backend}
 */
export default class WSBackend extends EventEmitter {
  private ws: WebSocket;
  private isReady: Promise<boolean>;

  /**
   * @param {Object|string} urlOrWS - WebSocket object or URL of the server.
   */
  constructor(urlOrWS: WebSocket | string) {
    super();
    /**
     * @type {WebSocket}
     */
    this.ws = typeof urlOrWS !== 'string' ? urlOrWS : new WebSocket(urlOrWS);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);

    let resolveReady: () => void;
    /**
     * @type {Promise}
     */
    this.isReady = new Promise((r) => { resolveReady = r; });
    this.ws.onopen = () => {
      this.emit('ready');
      resolveReady();
    };
  }

  public close() {
    this.ws.close();
  }

  public handleClose(event: CloseEvent) {
    if (event.code !== 1000) {
      this.emit('error', 'WebSocket closed unexpectedly');
    } else {
      this.emit('close');
    }
  }

  public handleError() {
    this.emit('error', 'WebSocket error');
  }

  public handleMessage(message: MessageEvent) {
    const data = JSON.parse(message.data);
    this.emit('data', data);
  }

  public execute(command: any) {
    this.isReady.then(() => {
      this.ws.send(JSON.stringify(command));
    });
  }
}
