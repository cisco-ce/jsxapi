import WS from 'ws';

import TSHBackend from './backend/tsh';
import WSBackend from './backend/ws';
import connectOverload from './connect';
import connectSSH from './transport/ssh';
import spawnTSH from './transport/tsh';
import websocketConnect from './transport/ws';
import { Options } from './types';

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

/**
 * Function for connecting to the XAPI.
 */
export const connect = connectOverload(initBackend, { protocol: 'ssh:' });
