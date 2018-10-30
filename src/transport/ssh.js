import DuplexPassThrough from 'duplex-passthrough';
import { Client } from 'ssh2';

import log from '../log';


/*
 * Patch DuplexPassThrough.prototype.on to always return "this".
 * For some event types it delegates and return the return value of
 * the contained reader/writer instances.
 */
if (!DuplexPassThrough.prototype.on.isPatched) {
  const origOn = DuplexPassThrough.prototype.on;
  const patchedFunc = function on(...args) {
    origOn.call(this, ...args);
    return this;
  };
  patchedFunc.isPatched = true;
  DuplexPassThrough.prototype.on = patchedFunc;
  DuplexPassThrough.prototype.addListener = patchedFunc;
}


/**
 * Creates a {@link Duplex} SSH stream.
 *
 * @param {object} options
 * @param {string} options.host - Hostname or IP address.
 * @param {number} options.port - Port to connect to.
 * @param {string} options.username - Username used in authentication.
 * @param {string} options.password - Password used in authentication.
 * @param {string} options.command
 * - If command is specified, it is executed on the remote host instead of a login shell.
 * @return {Duplex} - SSH stream.
 */
export default function connectSSH(options) {
  let closing = false;

  const mergedOpts = Object.assign({
    client: new Client(),
    transport: new DuplexPassThrough(),
  }, options);

  const { client, password, transport } = mergedOpts;
  delete mergedOpts.password;

  function onKeyboardInteractive(n, i, il, p, finish) {
    finish([password]);
  }

  function onReady() {
    log.debug('[SSH] connection ready');
    client.shell(false, (err, sshStream) => {
      if (err) {
        log.error('[SSH] shell error:', err);
        transport.emit('error', err);
        return;
      }

      log.debug('[SSH] shell ready');
      sshStream
        .on('error', (error) => { transport.emit('error', error); })
        .on('end', () => {
          if (!closing) {
            transport.emit('error', 'Connection terminated remotely');
          }
        })
        .on('close', () => { transport.emit('close'); });

      if (options.command) {
        client.exec(options.command, (binaryErr, binaryStream) => {
          if (binaryErr) {
            log.error('[SSH] exec error:', err);
            transport.emit('error', binaryErr);
            return;
          }
          binaryStream.on('error', (error) => {
            log.error('[SSH] stream error:', error);
            transport.emit('error', error);
          });
          log.debug('[SSH] exec ready');
          transport.wrapStream(binaryStream);
        });
        return;
      }

      transport.wrapStream(sshStream);
    });
  }

  client
    .on('keyboard-interactive', onKeyboardInteractive)
    .on('ready', onReady)
    .on('error', (error) => { transport.emit('error', error.level); })
    .on('close', () => { transport.emit('close'); })
    .connect(Object.assign({ tryKeyboard: true }, mergedOpts));

  transport.close = () => {
    closing = true;
    client.end();
  };

  return transport;
}
