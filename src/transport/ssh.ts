import DuplexPassThrough from 'duplex-passthrough';
import { Client, ConnectConfig } from 'ssh2';

import { Stream } from 'stream';
import log from '../log';

/*
 * Patch DuplexPassThrough.prototype.on to always return "this".
 * For some event types it delegates and return the return value of
 * the contained reader/writer instances.
 */
if (!DuplexPassThrough.prototype.on.isPatched) {
  const origOn = DuplexPassThrough.prototype.on;
  const patchedFunc = function on(...args: any[]) {
    origOn.call(this, ...args);
    return this;
  };
  (patchedFunc as any).isPatched = true;
  DuplexPassThrough.prototype.on = patchedFunc;
  DuplexPassThrough.prototype.addListener = patchedFunc;
}

export interface SshOptions {
  username?: string;
  client: any;
  password?: string;
  transport: any;
  command?: string;
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
export default function connectSSH(options: Partial<SshOptions>) {
  let closing = false;

  const mergedOpts: SshOptions & ConnectConfig = Object.assign(
    {
      client: new Client(),
      transport: new DuplexPassThrough(),
    },
    options,
  );

  const { client, password, transport } = mergedOpts;
  delete mergedOpts.password;

  function onKeyboardInteractive(
    n: any,
    i: any,
    il: any,
    p: any,
    finish: (args: any[]) => void,
  ) {
    finish([password]);
  }

  function onReady() {
    log.debug('[SSH] connection ready');
    client.shell(false, (err: any, sshStream: any) => {
      if (err) {
        log.error('[SSH] shell error:', err);
        transport.emit('error', err);
        return;
      }

      log.debug('[SSH] shell ready');
      sshStream
        .on('error', (error: any) => {
          transport.emit('error', error);
        })
        .on('end', () => {
          if (!closing) {
            transport.emit('error', 'Connection terminated remotely');
          }
        })
        .on('close', () => {
          transport.emit('close');
        });

      if (options.command) {
        client.exec(
          options.command,
          (binaryErr: string, binaryStream: Stream) => {
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
          },
        );
        return;
      }

      transport.wrapStream(sshStream);
    });
  }

  const agentSock = process.env.SSH_AUTH_SOCK;
  if (agentSock) {
    log.info(`Using SSH agent socket "${agentSock}"`);
    mergedOpts.agent = agentSock;
  }

  client
    .on('keyboard-interactive', onKeyboardInteractive)
    .on('ready', onReady)
    .on('error', (error: any) => {
      transport.emit('error', error.level);
    })
    .on('close', () => {
      transport.emit('close');
    })
    .connect(Object.assign({ tryKeyboard: true }, mergedOpts));

  transport.close = () => {
    closing = true;
    client.end();
  };

  return transport;
}
