import WebSocket from 'ws';

import connectImpl from './connect';
import connectSSH from './transport/ssh';
import TSHBackend from './backend/tsh';
import WSBackend from './backend/ws';
import spawnTSH from './transport/tsh';
import websocketConnect from './transport/ws';


function initBackend(opts) {
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
      const transport = websocketConnect(WebSocket, opts);
      return new WSBackend(transport);
    }
    default:
      throw new Error(`Invalid protocol: ${protocol}`);
  }
}

export function connect(...args) { // eslint-disable-line import/prefer-default-export
  return connectImpl(initBackend, {
    protocol: 'ssh:',
    username: 'admin',
  })(...args);
}
