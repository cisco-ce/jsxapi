import Url from 'url-parse';
import WS from 'ws';

import { Backend } from './backend';
import TSHBackend from './backend/tsh';
import WSBackend from './backend/ws';
import log from './log';
import connectSSH from './transport/ssh';
import spawnTSH from './transport/tsh';
import XAPI from './xapi';

export type XAPI = XAPI;

interface Options {
  command: string;
  host: string;
  password: string;
  port: number;
  protocol: string;
  username: string;
}

function generateAuthSubProto(username: string, password: string): string {
  const replaceChars: any = { '+': '-', '/': '_', '=': '' };
  const authHash = Buffer
    .from(`${username}:${password}`)
    .toString('base64')
    .replace(/[/+=]/g, (c) => replaceChars[c]);
  return `auth-${authHash}`;
}

function websocketConnect(opts: Options): WS | WebSocket {
  const { host, username, password, protocol } = opts;
  const url = new Url('');
  url.set('pathname', '/ws');
  url.set('host', host);
  url.set('protocol', protocol);

  const auth = generateAuthSubProto(username, password);
  return new WS(url.href, auth, {
    followRedirects: true,
    rejectUnauthorized: false,
  } as any);
}

function initBackend(opts: Options): Backend {
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
      const transport = websocketConnect(opts);
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
export function connect(url: any, options?: any) {
  // eslint-disable-line import/prefer-default-export
  if (arguments.length === 1 && typeof url === 'object') {
    /* eslint-disable no-param-reassign */
    options = url;
    url = '';
    /* eslint-enable */
  }

  const parsedUrl = new Url(url.match(/^\w+:\/\//) ? url : `ssh://${url}`);

  const opts = Object.assign(
    {
      host: '',
      loglevel: 'warn',
      password: '',
      protocol: 'ssh:',
      username: 'admin',
    },
    parsedUrl,
    options,
  );

  opts.host = opts.hostname;
  delete opts.hostname;

  log.setLevel(opts.loglevel);
  log.info('connecting to', url);

  const backend = initBackend(opts);
  return new XAPI(backend);
}
