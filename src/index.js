import Url from 'url-parse';
import WebSocket from 'ws';

import log from './log';
import connectSSH from './transport/ssh';
import XAPI from './xapi';
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


/**
 * Connect to an XAPI endpoint.
 *
 * @example
 * const xapi = connect('ssh://host.example.com:22');
 *
 * @param {string} url - Connection specification.
 * @param {Object} [options] - Connect options.
 * @param {string} [options.host] -
 *     Hostname to connect to.
 * @param {string} [options.username] -
 *     Username to authenticate with if protocol requires authentication.
 * @param {string} [options.password] -
 *     Password to authenticate with if protocol requires authentication.
 * @param {string} [options.loglevel] -
 *     Set the internal log level.
 * @return {XAPI} - XAPI interface connected to the given URI.
 */
export function connect(url, options) { // eslint-disable-line import/prefer-default-export
  if (arguments.length === 1 && typeof url === 'object') {
    /* eslint-disable no-param-reassign */
    options = url;
    url = '';
    /* eslint-enable */
  }

  const parsedUrl = new Url(url.match(/^\w+:\/\//) ? url : `ssh://${url}`);

  const opts = Object.assign({
    host: '',
    password: '',
    protocol: 'ssh:',
    username: 'admin',
    loglevel: 'warn',
  }, parsedUrl, options);

  opts.host = opts.hostname;
  delete opts.hostname;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  const backend = initBackend(opts);
  return new XAPI(backend);
}
