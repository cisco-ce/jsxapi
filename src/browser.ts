import { Backend } from './backend';
import WSBackend from './backend/ws';
import connectOverload from './connect';
import websocketConnect from './transport/ws';
import { Options } from './types';
import XAPI from './xapi';

export { default as XAPI } from './xapi';

function initBackend(opts: Options) {
  const { protocol } = opts;
  switch (protocol) {
    case '':
    case 'ws:':
    case 'wss:': {
      const createWebSocket = (url: string, auth: string) => {
        return new WebSocket(url, auth);
      };
      const transport = websocketConnect(createWebSocket, opts);
      return new WSBackend(transport);
    }
    default:
      throw new Error(`Invalid protocol: ${protocol}`);
  }
}

export function connectGen<T extends XAPI>(xapi: new (backend: Backend) => T) {
  return connectOverload<T>(initBackend, { protocol: 'wss:' })(xapi);
}

/**
 * Connect to an XAPI endpoint.
 *
 * ```typescript
 * const xapi = connect('ssh://host.example.com:22');
 * ```
 *
 * @param url Connection specification.
 * @param options Connect options.
 * @return XAPI interface connected to the given URI.
 */
export const connect = connectGen(XAPI);
