import { spawn } from 'child_process';

import duplex from 'duplexer';


const TSH_BIN = 'tsh';


/**
 * Use the TSH binary to connect to a TSH server.
 *
 * @param {string} host - Host to connect to.
 * @param {number} port - Port to connect to.
 * @return {Promise<Duplex>} - TSH {@link Duplex} stream.
 */
export default function spawnTSH(host, port) {
  const child = spawn(TSH_BIN, ['--port', port]);
  const stream = duplex(child.stdin, child.stdout);
  stream.close = () => child.kill();
  return stream;
}
