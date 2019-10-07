import { LogLevelDesc } from 'loglevel';
import { Backend } from './backend';

export interface Options {
  command: string;
  host: string;
  loglevel: LogLevelDesc;
  password: string;
  port: number;
  protocol: string;
  username: string;
}

export type InitBackend = (opts: Options) => Backend;
