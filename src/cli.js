#!/usr/bin/env node

import commander from 'commander';

import fs from 'fs';
import REPL from 'repl';

import pkg from '../package.json';
import log from './log';
import { connect } from './';


function evalFile(source, xapi) {
  const context = new Function('xapi', source); // eslint-disable-line no-new-func
  context(xapi);
}


function startRepl(xapi) {
  const repl = REPL.start({});
  repl.on('exit', () => xapi.close());
  repl.context.xapi = xapi;
}


commander
  .version(pkg.version)
  .arguments('<host> [file]')
  .description('connect to a codec and launch a repl')
  .option('-p, --port <port>', 'port to connect to', 22)
  .option('-U, --username <user>', 'username to authenticate with', 'admin')
  .option('-P, --password <password>', 'password to authenticate with', '')
  .option('-C, --command <command>', 'command to execute on remote host', '')
  .option(
    '-l, --loglevel <level>',
    'set application log level (trace|debug|info|warn|error|silent)',
    /^(trace|debug|info|warn|error|silent)$/i,
    'warn')
  .action((host, file, options) => {
    const { port, username, password, loglevel, command } = options;

    if (!host) {
      log.error('Please specify a host to connect to');
      commander.help();
    }

    log.setLevel(loglevel);

    const source = file && fs.readFileSync(file);
    const xapi = connect(host, { port, username, password, command })
      .on('error', (error) => { log.error('xapi error:', error); })
      .on('ready', () => {
        if (source) {
          evalFile(source, xapi);
        } else {
          startRepl(xapi);
        }
      });
  })
  .parse(process.argv);
