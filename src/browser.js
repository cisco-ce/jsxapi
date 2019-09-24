/* eslint-env browser */

import Url from 'url-parse';

import log from './log';
import XAPI from './xapi';
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

export function connect(url, options) { // eslint-disable-line import/prefer-default-export
  if (arguments.length === 1 && typeof url === 'object') {
    /* eslint-disable no-param-reassign */
    options = url;
    url = '';
    /* eslint-enable */
  }

  const opts = Object.assign({
    host: '',
    password: '',
    protocol: 'wss:',
    username: 'admin',
    loglevel: 'warn',
  }, new Url(url), options);

  opts.host = opts.hostname;
  delete opts.hostname;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  const backend = initBackend(opts);
  return new XAPI(backend);
}
