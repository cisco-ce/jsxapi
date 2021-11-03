import { EventEmitter } from 'events';

import log from '../log';
import normalizePath from './normalizePath';
import * as rpc from './rpc';

import { Backend } from '../backend';
import version from '../version';
import { Config, Event, Status } from './components';
import Feedback from './feedback';
import createXapiProxy from './proxy';
import { Path, XapiError, XapiOptions, XapiResponse } from './types';

export interface Requests {
  [idx: string]: {
    resolve(result: any): void;
    reject(result: XapiError): void;
  };
}

export declare interface XAPI {
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'ready', listener: (xapi: XAPI) => void): this;
  on(event: string, listener: () => void): this;
}

/**
 * User-facing API towards the XAPI. Requires a backend for communicating
 * with an XAPI instance. It should be possible to write backends for all kinds
 * of transports (TSH over SSH, Websockets, HTTP, plain sockets, etc.)
 *
 * ### Initialization
 *
 * ```typescript
 * const xapi = new XAPI(backend);
 * ```
 *
 * ### Invoke command
 *
 * ```typescript
 * xapi
 *   .command('Dial', { Number: 'johndoe@example.com' })
 *   .then(onSuccess, onFailure);
 *
 * // Alternate notation
 * xapi
 *   .Command.Dial({ Number: 'johndoe@example.com' })
 *   .then(onSuccess, onFailure);
 * ```
 *
 * ### Fetch a configuration
 *
 * ```typescript
 * xapi
 *   .config.get('Audio DefaultVolume')
 *   .then((volume) => console.log(`default volume is: ${volume}`));
 *
 * // Alternate notation
 * xapi.Audio.DefaultVolume
 *   .get()
 *   .then((volume) => console.log(`default volume is: ${volume}`));
 * ```
 *
 * ### Set a configuration
 *
 * ```typescript
 * xapi.config.set('Audio DefaultVolume', 100);
 *
 * // Alternate notation
 * xapi.Audio.DefaultVolume.set(100);
 * ```
 *
 * ### Fetch a status
 *
 * ```typescript
 * xapi
 *   .status.get('Audio Volume')
 *   .then((volume) => { console.log(`volume is: ${volume}`); });
 *
 * // Alternate notation
 * xapi.Status.Audio.Volume
 *   .get()
 *   .then((volume) => { console.log(`volume is: ${volume}`); });
 * ```
 *
 * ### Listen to an event
 *
 * ```typescript
 * xapi.event.on('Message Send Text', (text) => {
 *   console.log(`Received message text: ${text}`);
 * });
 *
 * // Alternate notation
 * xapi.Event.Message.Send.Text.on((text) => {
 *   console.log(`Received message text: ${text}`);
 * });
 * ```
 */
export class XAPI extends EventEmitter {
  public version: string = version;

  /**
   * Interface to XAPI feedback registration.
   */
  public feedback: Feedback;

  /**
   * Interface to XAPI configurations.
   */
  public config = new Config(this);

  /**
   * Interface to XAPI events.
   */
  public event = new Event(this);

  /**
   * Interface to XAPI statuses.
   */
  public status = new Status(this);

  /**
   * Proxy for XAPI Status.
   */
  public Command: any;

  /**
   * Proxy for XAPI Status.
   */

  public Config: any;
  /**
   * Proxy for XAPI Status.
   */

  public Status: any;

  /**
   * Proxy for XAPI Status.
   */
  public Event: any;

  /**
   * @param backend Backend connected to an XAPI instance.
   * @param options XAPI object options.
   */

  private requestId = 1;
  private requests: Requests = {};

  constructor(
    private readonly backend: Backend,
    options: XapiOptions = {}) {
    super();

    this.feedback = new Feedback(this, options.feedbackInterceptor);
    this.Command = createXapiProxy(this, this.command);
    this.Config = createXapiProxy(this, this.config);
    this.Event = createXapiProxy(this, this.event);
    this.Status = createXapiProxy(this, this.status);

    // Restrict object mutation
    if (!options.hasOwnProperty('seal') || options.seal) {
      Object.defineProperties(this, {
        Command: { writable: false },
        Config: { writable: false },
        Event: { writable: false },
        Status: { writable: false },
        config: { writable: false },
        event: { writable: false },
        feedback: { writable: false },
        status: { writable: false },
      });
      Object.seal(this);
    }

    backend
      .on('close', () => {
        this.emit('close');
      })
      .on('error', (error) => {
        this.emit('error', error);
      })
      .on('ready', () => {
        this.emit('ready', this);
      })
      .on('data', this.handleResponse.bind(this));
  }

  /**
   * Close the XAPI connection.
   */
  public close(): XAPI {
    this.backend.close();
    return this;
  }

  /**
   * Executes the command specified by the given path.
   *
   * ```typescript
   * // Space delimited
   * xapi.command('Presentation Start');
   *
   * // Slash delimited
   * xapi.command('Presentation/Start');
   *
   * // Array path
   * xapi.command(['Presentation', 'Start']);
   *
   * // With parameters
   * xapi.command('Presentation Start', { PresentationSource: 1 });
   *
   * // Multi-line
   * xapi.command('UserInterface Extensions Set', { ConfigId: 'example' }, `
   *  <Extensions>
   *    <Version>1.1</Version>
   *    <Panel item="1" maxOccurrence="n">
   *      <Icon>Lightbulb</Icon>
   *      <Type>Statusbar</Type>
   *      <Page item="1" maxOccurrence="n">
   *        <Name>Foo</Name>
   *        <Row item="1" maxOccurrence="n">
   *          <Name>Bar</Name>
   *          <Widget item="1" maxOccurrence="n">
   *            <WidgetId>widget_3</WidgetId>
   *            <Type>ToggleButton</Type>
   *          </Widget>
   *        </Row>
   *      </Page>
   *    </Panel>
   *  </Extensions>
   * `);
   * ```
   *
   * @param path Path to command node.
   * @param params Object containing named command arguments.
   * @param body Multi-line body for commands requiring it.
   * @return Resolved with the command response when ready.
   */
  public command<T = any>(path: Path, params?: object | string, body?: string): Promise<T> {
    const apiPath = normalizePath(path).join('/');
    const method = `xCommand/${apiPath}`;

    let executeParams;
    if (typeof params === 'string' && typeof body === 'undefined') {
      executeParams = { body: params };
    } else if ((typeof params === 'object' || !params) && typeof body === 'string') {
      executeParams = Object.assign({ body }, params);
    } else {
      executeParams = params;
    }

    return this.execute<T>(method, executeParams);
  }

  /**
   * Interface to XAPI documents.
   *
   * @param path Path to xDocument.
   * @return xDocument as specified by path.
   */
  public doc<T = any>(path: Path) {
    return this.execute<T>('xDoc', {
      Path: normalizePath(path),
      Type: 'Schema',
    });
  }

  /**
   * Execute the given JSON-RPC request on the backend.
   *
   * ```typescript
   * xapi.execute('xFeedback/Subscribe', {
   *   Query: ['Status', 'Audio'],
   * });
   * ```
   *
   * @param method Name of RPC method to invoke.
   * @param params Parameters to add to the request.
   * @typeparam T Return type.
   * @return Resolved with the command response.
   */
  public execute<T>(method: string, params: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId();
      const request = rpc.createRequest(id, method, params);
      this.backend.execute(request);
      this.requests[id] = { resolve, reject };
    });
  }

  private handleResponse(response: XapiResponse) {
    const { id, method } = response;
    if (method === 'xFeedback/Event') {
      log.debug('feedback:', response);
      this.feedback.dispatch(response.params);
    } else {
      if ({}.hasOwnProperty.call(response, 'result')) {
        log.debug('result:', response);
        const { resolve } = this.requests[id];
        resolve(response.result);
      } else {
        log.debug('error:', response);
        const { reject } = this.requests[id];
        reject(response.error);
      }
      delete this.requests[id];
    }
  }

  private nextRequestId() {
    const requestId = this.requestId;
    this.requestId += 1;
    return requestId.toString();
  }
}

export default XAPI;
