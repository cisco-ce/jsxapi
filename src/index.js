import parseUrl from 'url-parse';
import WebSocket from 'ws';

import log from './log';
import connectSSH from './transport/ssh';
import XAPI from './xapi';
import TSHBackend from './backend/tsh';
import WSBackend from './backend/ws';
import spawnTSH from './transport/tsh';


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

  const parsedUrl = parseUrl(url.match(/^\w+:\/\//) ? url : `ssh://${url}`);

  const opts = Object.assign({
    host: '',
    password: '',
    protocol: 'ssh:',
    username: 'admin',
    loglevel: 'warn',
  }, parsedUrl, options);

  const { hostname: host, port } = opts;
  delete opts.hostname;
  opts.host = host;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  let backend;
  switch (opts.protocol) {
    case '':
    case 'ssh:': {
      const transport = connectSSH(opts);
      backend = new TSHBackend(transport);
      break;
    }
    case 'tsh:': {
      const transport = spawnTSH(host, port);
      backend = new TSHBackend(transport);
      break;
    }
    case 'ws:':
    case 'wss:': {
      const transport = new WebSocket(url);
      backend = new WSBackend(transport);
      break;
    }
    default:
      throw new Error(`Invalid protocol: ${opts.protocol}`);
  }

  return new XAPI(backend);
}
