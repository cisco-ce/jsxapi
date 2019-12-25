import Url from 'url-parse';

import log from './log';
import { InitBackend, Options } from './types';
import XAPI from './xapi';

export const globalDefaults: Options = {
  command: '',
  host: '',
  loglevel: 'warn',
  password: '',
  port: 0,
  protocol: '',
  username: 'admin',
};

export interface Connect {
  (options: Partial<Options>): XAPI;
  (url: string, options?: Partial<Options>): XAPI;
}

function resolveOptions(
  targetDefaults: Partial<Options>,
  url: string,
  options: Options,
): Options {
  const realOpts: Options = {
    ...globalDefaults,
    ...targetDefaults,
  };

  const urlWithProto = url.match(/^\w+:\/\//)
    ? url
    : `${realOpts.protocol}//${url}`;
  const parsedUrl = new Url(urlWithProto);

  Object.keys(realOpts).forEach((key) => {
    const value = [
      (options as any)[key],
      key === 'host' ? parsedUrl.hostname : (parsedUrl as any)[key],
    ].filter((v) => !!v)[0];
    if (value) {
      (realOpts as any)[key] = value;
    }
  });

  return realOpts;
}

/**
 * Connect to an XAPI endpoint.
 *
 * ```typescript
 * const xapi = connect('ssh://host.example.com:22');
 * ```
 *
 * @param url Connection specification.
 * @param options Connect options.
 * @return XAPI interface connected to the given URI.
 */
export default function connectOverload(
  initBackend: InitBackend,
  defaults: Partial<Options>,
): Connect {
  return (...args: any[]) => {
    let url: string;
    let options: Options;

    if (args.length === 1 && typeof args[0] === 'object') {
      options = args[0];
      url = '';
    } else if (args.length === 1 && typeof args[0] === 'string') {
      options = globalDefaults;
      url = args[0];
    } else if (args.length === 2) {
      url = args[0];
      options = args[1];
    } else {
      throw new Error(`Invalid arguments to connect`);
    }

    const opts = resolveOptions(defaults, url, options);

    log.setLevel(opts.loglevel);
    log.debug('using options:', opts);
    log.info('connecting to', url);

    const backend = initBackend(opts);
    return new XAPI(backend);
  };
}
