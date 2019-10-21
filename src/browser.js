/* eslint-env browser */

import connectImpl from './connect';
import WSBackend from './backend/ws';
import websocketConnect from './transport/ws';

function initBackend(opts) {
  const { protocol } = opts;
  switch (protocol) {
    case '':
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
    protocol: 'wss:',
    username: 'admin',
  })(...args);
}
