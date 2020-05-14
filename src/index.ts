import WS from 'ws';

import { Backend } from './backend';
import TSHBackend from './backend/tsh';
import WSBackend from './backend/ws';
import connectOverload from './connect';
import connectSSH from './transport/ssh';
import spawnTSH from './transport/tsh';
import websocketConnect from './transport/ws';
import { Options } from './types';
import XAPI from './xapi';

export { default as XAPI } from './xapi';

function initBackend(opts: Options) {
  const { host, port, protocol } = opts;
  switch (protocol) {
    case '':
    case 'ssh:': {
      const transport = connectSSH(opts);
      return new TSHBackend(transport);
    }
    case 'tsh:': {
      const transport = spawnTSH(host, port);
      return new TSHBackend(transport);
    }
    case 'ws:':
    case 'wss:': {
      const createWebSocket = (url: string, auth: string) => {
        const ws = new WS(url, auth, {
          followRedirects: true,
          rejectUnauthorized: false,
        } as any);
        return ws as any;
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
