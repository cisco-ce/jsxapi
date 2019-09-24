import Url from 'url-parse';

function base64Enc(input) {
  return (typeof btoa === 'function')
    ? btoa(input) // eslint-disable-line no-undef
    : Buffer.from(input).toString('base64');
}

function generateAuthSubProto(username, password) {
  const authHash = base64Enc(`${username}:${password}`)
    .replace(/[/+=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  return `auth-${authHash}`;
}

export default function websocketConnect(WebSocket, opts) {
  const { host, username, password, protocol } = opts;
  const url = new Url();
  url.set('pathname', '/ws');
  url.set('host', host);
  url.set('protocol', protocol);

  const auth = generateAuthSubProto(username, password);
  return new WebSocket(url.href, auth, {
    followRedirects: true,
    rejectUnauthorized: false,
  });
}
