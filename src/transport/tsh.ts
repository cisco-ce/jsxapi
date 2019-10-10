import { spawn } from 'child_process';

/// <reference path="./duplexer.d.ts" />
import duplex from 'duplexer';
import { CloseableStream } from '../xapi/types';

const TSH_BIN = 'tsh';

/**
 * Use the TSH binary to connect to a TSH server.
 *
 * @param {string} host - Host to connect to.
 * @param {number} port - Port to connect to.
 * @return {Promise<Duplex>} - TSH {@link Duplex} stream.
 */
export default function spawnTSH(host: string, port: number) {
  const child = spawn(TSH_BIN, ['--port', port.toString()]);
  const stream: CloseableStream = duplex(child.stdin, child.stdout) as any;
  stream.close = () => child.kill();
  return stream;
}
