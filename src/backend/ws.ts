import { EventEmitter } from 'events';
import WS from 'ws';

import log from '../log';
import { XapiRequest } from '../xapi/types';
import { Backend } from './';

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
export default class WSBackend extends EventEmitter implements Backend {
  private ws: WS | WebSocket;
  private isReady: Promise<boolean>;

  /**
   * @param {Object|string} urlOrWS - WebSocket object or URL of the server.
   */
  constructor(urlOrWS: WS | WebSocket | string) {
    super();
    /**
     * @type {WebSocket}
     */
    this.ws = typeof urlOrWS !== 'string' ? urlOrWS : new WebSocket(urlOrWS);
    this.ws.onclose = this.handleClose;
    this.ws.onerror = this.handleError;
    this.ws.onmessage = this.handleMessage;

    let resolveReady: (ready: boolean) => void;
    /**
     * @type {Promise}
     */
    this.isReady = new Promise((r) => {
      resolveReady = r;
    });
    this.ws.onopen = () => {
      this.emit('ready');
      resolveReady(true);
    };
  }

  public close() {
    this.ws.close();
  }

  public execute(command: XapiRequest): Promise<void> {
    return this.isReady.then(() => {
      log.debug('[transport] (send): ', JSON.stringify(command));
      this.ws.send(JSON.stringify(command));
    });
  }

  private handleClose: WebSocket['onclose'] = (event) => {
    if (event.code !== 1000) {
      this.emit('error', 'WebSocket closed unexpectedly');
    } else {
      this.emit('close');
    }
  }

  private handleError: WebSocket['onerror'] = (error) => {
    this.emit('error', (error as ErrorEvent).error);
  }

  private handleMessage: WebSocket['onmessage'] = (message) => {
    log.debug('[transport] (receive): ', message.data);
    const data = JSON.parse(message.data as string);
    this.emit('data', data);
  }
}
