import Url from 'url-parse';

import log from './log';
import XAPI from './xapi';

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
export default function connect(url, options, initBackend) { // eslint-disable-line import/prefer-default-export
  if (arguments.length === 1 && typeof url === 'object') {
    /* eslint-disable no-param-reassign */
    options = url;
    url = '';
    /* eslint-enable */
  }

  const opts = Object.assign({}, new Url(url), options);

  opts.host = opts.hostname;
  delete opts.hostname;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  const backend = initBackend(opts);
  return new XAPI(backend);
}
