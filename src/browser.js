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

export function connect(url, options) {
  const opts = Object.assign({
    host: '',
    password: '',
    protocol: 'wss:',
    username: 'admin',
    loglevel: 'warn',
  }, options);
  return connectImpl(url, opts, initBackend);
}
