import Url from 'url-parse';

import { Options } from '../types';

export type CreateWebSocket = (url: string, auth: string) => WebSocket;

function base64Enc(input: string) {
  return (typeof btoa === 'function')
    ? btoa(input)
    : Buffer.from(input).toString('base64');
}

function generateAuthSubProto(username: string, password: string): string {
  const replaceChars: any = { '+': '-', '/': '_', '=': '' };
  const authHash = Buffer
    .from(`${username}:${password}`)
    .toString('base64')
    .replace(/[/+=]/g, (c) => replaceChars[c]);
  return `auth-${authHash}`;
}

export default function websocketConnect(createWebSocket: CreateWebSocket, opts: Options) {
  const { host, username, password, port, protocol } = opts;
  const url = new Url('');
  url.set('pathname', '/ws');
  url.set('host', host);
  url.set('protocol', protocol);
  url.set('port', `${port}`);

  const auth = generateAuthSubProto(username, password);
  return createWebSocket(url.href, auth);
}
