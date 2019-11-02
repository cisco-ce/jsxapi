import Url from 'url-parse';

import log from './log';
import XAPI from './xapi';

export const globalDefaults = {
  command: '',
  host: '',
  loglevel: 'warn',
  password: '',
  port: 0,
  protocol: '',
  username: 'admin',
};

function resolveOptions(targetDefaults, url, options) {
  const realOpts = {
    ...globalDefaults,
    ...targetDefaults,
  };

  const urlWithProto = url.match(/^\w+:\/\//) ? url : `${realOpts.protocol}//${url}`;
  const parsedUrl = new Url(urlWithProto);

  Object.keys(realOpts).forEach((key) => {
    const value = [
      options[key],
      key === 'host' ? parsedUrl.hostname : parsedUrl[key],
    ].filter(v => !!v)[0];
    if (value) {
      realOpts[key] = value;
    }
  });

  return realOpts;
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
export default function connect(initBackend, defaults) {
  return (...args) => {
    let url;
    let options;

    if (args.length === 1 && typeof args[0] === 'object') {
      [options] = args;
      url = '';
    } else if (args.length === 1 && typeof args[0] === 'string') {
      options = {};
      [url] = args;
    } else if (args.length === 2) {
      [url, options] = args;
    } else {
      throw new Error('Invalid arguments to connect');
    }

    const opts = resolveOptions(defaults, url, options);

    log.setLevel(opts.loglevel);
    log.info('connecting to', url);

    const backend = initBackend(opts);
    return new XAPI(backend);
  };
}
