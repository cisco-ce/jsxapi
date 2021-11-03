import { JSONParser } from '../json-parser';
import log from '../log';
import * as rpc from '../xapi/rpc';

import { CloseableStream } from '../xapi/types';
import Backend from './';

/**
 * @external {Duplex} https://nodejs.org/api/stream.html#stream_class_stream_duplex
 */

function formatValue(value: any) {
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

function paramString(key: string, value: string | string[]) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((v) => `${key}: ${formatValue(v)}`).join(' ');
}

export type State = 'idle' | 'connecting' | 'initializing' | 'closed' | 'ready';

/**
 * Backend to communicate with a {@link Duplex} stream talking tshell (tsh).
 *
 * @extends {Backend}
 */
export default class TSHBackend extends Backend {
  private feedbackQueries: { [idx: string]: string } = {};
  private nextFeedbackId = 0;
  private parser = new JSONParser();
  private buffer = '';
  private state: State = 'idle';
  /**
   * @param {Duplex} transport - Stream to interact with TSH.
   */
  constructor(readonly transport: CloseableStream) {
    super();

    this.parser.on('data', this.onParserData.bind(this));
    this.parser.on('error', (error) => this.emit('error', error));

    Object.defineProperty(this, 'isReady', {
      configurable: false,
      enumerable: true,
      value: new Promise((resolve, reject) => {
        if (this.state !== 'idle') {
          reject(new Error('TSHBackend is not in an idle state'));
          return;
        }

        this.connectResolve = resolve;
        this.setState('connecting');
      }),
      writable: false,
    });

    this.transport
      .on('data', (data) => this.onTransportData(data))
      .on('error', (error) => this.emit('error', error))
      .on('close', () => {
        this.setState('closed');
        this.emit('close');
      });
  }

  /**
   * @override
   */
  public close() {
    this.transport.close();
  }

  /**
   * @override
   */
  public send(id: string, command: string, body: string) {
    let cmd = `${command} | resultId="${id}"\n`;
    if (body !== undefined) {
      cmd += `${body}\n`;
      const length = Buffer.byteLength(cmd, 'utf8');
      cmd = `{${length}} \n${cmd}`;
    }

    this.write(cmd);
  }

  public onTransportData(data: any) {
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
        this.emit(
          'error',
          new Error('TSHBackend is in an invalid state for input'),
        );
    }
  }

  private bufferHasOK(buffer: any) {
    const lines = (this.buffer + buffer.toString()).split('\n');
    if (lines.length) {
      this.buffer = lines[lines.length - 1];
    }
    return lines.some((line) => line === 'OK');
  }

  private setState(newState: State) {
    this.state = newState;
  }

  private onParserData(data: any) {
    if (!{}.hasOwnProperty.call(data, 'ResultId')) {
      log.debug('[tsh] (feedback):', JSON.stringify(data));
      this.onFeedback(rpc.parseFeedbackResponse(data));
    } else {
      log.debug('[tsh] (result):', JSON.stringify(data));
      this.onResult(data.ResultId, data);
    }
  }

  private write(data: string) {
    log.debug(`write: ${JSON.stringify(data)}`);
    this.transport.write(data);
  }

  // XAPI json-rpc method handlers

  /**
   * @ignore
   */
  private ['xCommand()']({ method, params }: any, send: any) {
    const paramsCopy = Object.assign({}, params);
    const { body } = paramsCopy;
    delete paramsCopy.body;

    const tshParams = paramsCopy
      ? Object.keys(paramsCopy)
          .sort()
          .map((k) => paramString(k, paramsCopy[k]))
      : [];

    const cmd = method
      .split('/')
      .concat(tshParams)
      .join(' ');

    return send(cmd, body).then(rpc.createCommandResponse);
  }

  /**
   * @ignore
   */
  private ['xDoc()'](request: any, send: any) {
    const { Path, Type } = request.params;

    const tshParams: any = {
      Format: 'JSON',
      Path: Path.join('/'),
      Schema: Type === 'Schema' ? 'True' : 'False',
    };

    const paramsStr = Object.keys(tshParams)
      .sort()
      .map((k) => paramString(k, tshParams[k]))
      .join(' ');

    return send(`xDocument ${paramsStr}`).then((response: any) =>
      rpc.createDocumentResponse(request, response),
    );
  }

  /**
   * @ignore
   */
  private ['xFeedback/Subscribe()']({ params }: any, send: any) {
    const query: string = params.Query.map((part: number | string) =>
      typeof part === 'number' ? `[${part}]` : `/${part}`,
    ).join('');
    return send(`xfeedback register ${query}`).then(() => {
      const id = this.nextFeedbackId;
      this.nextFeedbackId += 1;
      this.feedbackQueries[id] = query;
      return { Id: id };
    });
  }

  /**
   * @ignore
   */
  private ['xFeedback/Unsubscribe()']({ params }: any, send: any) {
    const id = params.Id;

    if (!{}.hasOwnProperty.call(this.feedbackQueries, id)) {
      throw new Error(`Invalid feedback id: ${id}`);
    }

    const path = this.feedbackQueries[id];

    return send(`xfeedback deregister ${path}`).then(() => {
      delete this.feedbackQueries[id];
      return true;
    });
  }

  /**
   * @ignore
   */
  private ['xGet()'](request: any, send: any) {
    const path = request.params.Path.join(' ');
    return send(`x${path}`).then((response: any) =>
      rpc.createGetResponse(request, response),
    );
  }

  /**
   * @ignore
   */
  private ['xSet()'](request: any, send: any) {
    const { params } = request;
    const path = params.Path.join(' ');
    const value = formatValue(params.Value);
    return send(`x${path}: ${value}`).then((response: any) =>
      rpc.createSetResponse(request, response),
    );
  }
  private connectResolve: (ok: boolean) => void = () => {
    /* noop */
  }
}
