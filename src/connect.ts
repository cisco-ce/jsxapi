import Url from 'url-parse';

import log from './log';
import { InitBackend, Options } from './types';
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
export default function connect(url: string, options: Options, initBackend: InitBackend) {
  if (arguments.length === 1 && typeof url === 'object') {
    /* eslint-disable no-param-reassign */
    options = url;
    url = '';
    /* eslint-enable */
  }

  const parsedUrl = new Url(url);
  const opts: Options = Object.assign({}, parsedUrl, options);
  opts.host = parsedUrl.hostname;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  const backend = initBackend(opts);
  return new XAPI(backend);
}
