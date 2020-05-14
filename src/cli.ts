#!/usr/bin/env node

import commander from 'commander';

import * as fs from 'fs';
import * as path from 'path';
import * as REPL from 'repl';
import xdgBasedir from 'xdg-basedir';

import { connect } from './';
import log from './log';
import fetch from './schema/fetch';
import generate from './schema/generate';
import version from './version';
import XAPI from './xapi/index.js';

function evalFile(source: any, xapi: XAPI) {
  const context = new Function('xapi', source);
  context(xapi);
}

function startRepl(xapi: XAPI) {
  const repl = REPL.start({});
  const { cache } = xdgBasedir;
  if (cache && repl.setupHistory) {
    const jsxapiCache = path.join(cache, 'jsxapi');
    fs.mkdirSync(jsxapiCache, { recursive: true });
    repl.setupHistory(path.join(jsxapiCache, 'history'), () => undefined);
  }
  repl.on('exit', () => xapi.close());
  repl.context.xapi = xapi;
}

/**
 * Main entrypoint for the CLI application.
 *
 * See [[Options]] for options.
 */
function main() {
  commander
    .command('generate-api <hosts...>')
    .description('generate a typed XAPI based on schemas on <hosts>')
    .action(async (hosts) => {
      const xapis = hosts.map((host: string) => connect(host));
      const docs = await fetch(xapis);
      // tslint:disable-next-line no-console
      console.log(generate(docs));
      xapis.forEach((xapi: XAPI) => xapi.close());
    });

  commander
    .version(version)
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

      const source = file && fs.readFileSync(file);
      const xapi = connect(
        host,
        options,
      )
        .on('error', (error: any) => {
          log.error('xapi error:', error);
        })
        .on('ready', () => {
          if (source) {
            evalFile(source, xapi);
          } else {
            startRepl(xapi);
          }
        });
    })
    .parse(process.argv);
}

main();
