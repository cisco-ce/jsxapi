#!/usr/bin/env node

import commander from 'commander';

import fs from 'fs';
import REPL from 'repl';

import pkg from '../package.json';
import log from './log';
import { connect } from '.';


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
  .option('-p, --port <port>', 'port to connect to')
  .option('-U, --username <user>', 'username to authenticate with', 'admin')
  .option('-P, --password <password>', 'password to authenticate with', '')
  .option('-C, --command <command>', 'command to execute on remote host', '')
  .option(
    '-l, --loglevel <level>',
    'set application log level (trace|debug|info|warn|error|silent)',
    /^(trace|debug|info|warn|error|silent)$/i,
    'warn',
  )
  .action((host, file, options) => {
    if (!host) {
      log.error('Please specify a host to connect to');
      commander.help();
    }

    const opts = {
      command: options.command,
      host: options.host,
      loglevel: options.loglevel,
      password: options.password,
      username: options.username,
    };

    const source = file && fs.readFileSync(file);
    const xapi = connect(host, opts)
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
