import { LogLevelDesc } from 'loglevel';
import { Backend } from './backend';

/**
 * Connection options.
 */
export interface Options {
  /**
   * SSH command used to initialize TSH (e.g. /bin/tsh)
   */
  command: string;
  /**
   * Hostname to connec to.
   */
  host: string;
  /**
   * Log level.
   */
  loglevel: LogLevelDesc;
  /**
   * Password used for authorization.
   */
  password: string;
  /**
   * Port number.
   */
  port: number;
  /**
   * Protocol for the connection (e.g. ssh:, wss:)
   */
  protocol: string;
  /**
   * Username used for authorization.
   */
  username: string;
}

export type InitBackend = (opts: Options) => Backend;
