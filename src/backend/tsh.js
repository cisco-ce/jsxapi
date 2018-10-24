import log from '../log';
import { JSONParser } from '../json-parser';
import * as rpc from '../xapi/rpc';

import Backend from './';


/**
 * @external {Duplex} https://nodejs.org/api/stream.html#stream_class_stream_duplex
 */


function formatValue(value) {
  switch (typeof value) {
    case 'boolean':
      return value ? 'True' : 'False';
    case 'number':
    case 'string':
      return JSON.stringify(value);
    default:
      throw new TypeError(`Invalid value ${JSON.stringify(value)}`);
  }
}


function paramString(key, value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(v => `${key}: ${formatValue(v)}`)
    .join(' ');
}


/**
 * Backend to communicate with a {@link Duplex} stream talking tshell (tsh).
 *
 * @extends {Backend}
 */
export default class TSHBackend extends Backend {
  /**
   * @param {Duplex} transport - Stream to interact with TSH.
   */
  constructor(transport) {
    super();

    this.feedbackQueries = {};
    this.nextFeedbackId = 0;
    this.parser = new JSONParser();
    this.requests = {};
    this.transport = transport;
    this.setState('idle');
    this.buffer = '';

    this.parser.on('data', this.onParserData.bind(this));
    this.parser.on('error', error => this.emit('error', error));

    Object.defineProperty(this, 'isReady', {
      configurable: false,
      enumerable: true,
      writable: false,
      value: new Promise((resolve, reject) => {
        if (this.state !== 'idle') {
          reject(new Error('TSHBackend is not in an idle state'));
          return;
        }

        this.connectResolve = resolve;
        this.setState('connecting');
      }),
    });

    this.transport
      .on('data', data => this.onTransportData(data))
      .on('error', error => this.emit('error', error))
      .on('close', () => {
        this.setState('closed');
        this.emit('close');
      });
  }

  bufferHasOK(buffer) {
    const lines = (this.buffer + buffer.toString()).split('\n');
    if (lines.length) {
      this.buffer = lines[lines.length - 1];
    }
    return lines.some(line => line === 'OK');
  }

  setState(newState) {
    this.state = newState;
  }

  /**
   * @override
   */
  close() {
    this.transport.close();
  }

  onParserData(data) {
    if (!{}.hasOwnProperty.call(data, 'ResultId')) {
      log.debug('[tsh] (feedback):', JSON.stringify(data));
      this.onFeedback(rpc.parseFeedbackResponse(data));
    } else {
      log.debug('[tsh] (result):', JSON.stringify(data));
      this.onResult(data.ResultId, data);
    }
  }

  onTransportData(data) {
    switch (this.state) {
      case 'connecting':
        if (this.bufferHasOK(data)) {
          log.debug('[transport] (connecting)', data.toString());
          this.setState('initializing');
          this.write('echo off\n');
          this.emit('initializing');
        }
        break;
      case 'initializing':
        if (this.bufferHasOK(data)) {
          log.debug('[transport] (initializing)', data.toString());
          this.buffer = '';
          this.write('xpreferences outputmode json\n');
          this.setState('ready');
          this.connectResolve(true);
          this.emit('ready');
        }
        break;
      case 'ready':
        log.debug(`to parser: "${data.toString()}"`);
        this.parser.write(data);
        break;
      default:
        this.emit('error', new Error('TSHBackend is in an invalid state for input'));
    }
  }

  /**
   * @override
   */
  send(id, command, body) {
    let cmd = `${command} | resultId="${id}"\n`;
    if (body !== undefined) {
      cmd += `${body}\n`;
      const length = cmd.length;
      cmd = `{${length}} \n${cmd}`;
    }

    this.write(cmd);
  }

  write(data) {
    log.debug(`write: ${JSON.stringify(data)}`);
    this.transport.write(data);
  }

  // XAPI json-rpc method handlers

  /**
   * @ignore
   */
  ['xCommand()']({ method, params }, send) { // eslint-disable-line class-methods-use-this
    const paramsCopy = Object.assign({}, params);
    const body = paramsCopy.body;
    delete paramsCopy.body;

    const tshParams = paramsCopy
      ? Object
        .keys(paramsCopy)
        .sort()
        .map(k => paramString(k, paramsCopy[k]))
      : [];

    const cmd = method
      .split('/')
      .concat(tshParams)
      .join(' ');

    return send(cmd, body)
      .then(rpc.createCommandResponse);
  }

  /**
   * @ignore
   */
  ['xFeedback/Subscribe()']({ params }, send) {
    const query = params.Query
      .map(part => (typeof part === 'number' ? `[${part}]` : `/${part}`))
      .join('');
    return send(`xfeedback register ${query}`)
      .then(() => {
        const id = this.nextFeedbackId;
        this.nextFeedbackId += 1;
        this.feedbackQueries[id] = query;
        return { Id: id };
      });
  }

  /**
   * @ignore
   */
  ['xFeedback/Unsubscribe()']({ params }, send) {
    const id = params.Id;

    if (!{}.hasOwnProperty.call(this.feedbackQueries, id)) {
      throw new Error(`Invalid feedback id: ${id}`);
    }

    const path = this.feedbackQueries[id];

    return send(`xfeedback deregister ${path}`)
      .then(() => {
        delete this.feedbackQueries[id];
        return true;
      });
  }

  /**
   * @ignore
   */
  ['xGet()'](request, send) { // eslint-disable-line class-methods-use-this
    const path = request.params.Path.join(' ');
    return send(`x${path}`)
      .then(response => rpc.createGetResponse(request, response));
  }

  /**
   * @ignore
   */
  ['xSet()'](request, send) { // eslint-disable-line class-methods-use-this
    const { params } = request;
    const path = params.Path.join(' ');
    const value = formatValue(params.Value);
    return send(`x${path}: ${value}`)
      .then(response => rpc.createSetResponse(request, response));
  }
}
