import { EventEmitter } from 'events';

import log from '../log';
import * as rpc from './rpc';
import normalizePath from './normalizePath';

import Feedback from './feedback';
import { Config, Event, Status } from './components';


/**
 * User-facing API towards the XAPI. Requires a backend for communicating
 * with an XAPI instance. It should be possible to write backends for all kinds
 * of transports (TSH over SSH, Websockets, HTTP, plain sockets, etc.)
 *
 * @example <caption>Initialization</caption>
 * const xapi = new XAPI(backend);
 *
 * @example <caption>Invoke commands</caption>
 * xapi
 *   .command('Dial', { Number: 'johndoe@example.com' })
 *   .then(onSuccess, onFailure);
 *
 * @example <caption>Fetch a status</caption>
 * xapi
 *   .status.get('Audio Volume')
 *   .then((value) => { console.log(value); });
 *
 * @example <caption>Set a configuration</caption>
 * xapi
 *   .config.set('Audio DefaultVolume', 100);
 *
 * @example <caption>Listen to an event</caption>
 * xapi.event.on('Some Event Name', (data) => {
 *   console.log(`Received feedback data: ${data}`);
 * });
 */
export default class XAPI extends EventEmitter {
  /**
   * @param {Backend} backend - Backend connected to an XAPI instance.
   * @param {object} options - XAPI object options.
   * @param {function} options.feedbackInterceptor - Feedback interceptor.
   */
  constructor(backend, options = {}) {
    super();

    /** @type {Backend} */
    this.backend = backend;

    /** @ignore */
    this.requestId = 1;

    /** @ignore */
    this.requests = {};

    /**
     * Interface to XAPI feedback registration.
     * @type {Feedback}
     */
    this.feedback = new Feedback(this, options.feedbackInterceptor);

    /**
     * Interface to XAPI configurations.
     * @type {Config}
     */
    this.config = new Config(this);

    /**
     * Interface to XAPI events.
     * @type {Event}
     */
    this.event = new Event(this);

    /**
     * Interface to XAPI statuses.
     * @type {Status}
     */
    this.status = new Status(this);

    // Restrict object mutation
    Object.defineProperties(this, {
      config: { writable: false },
      event: { writable: false },
      feedback: { writable: false },
      status: { writable: false },
    });
    Object.seal(this);

    backend
      .on('close', () => { this.emit('close'); })
      .on('error', (error) => { this.emit('error', error); })
      .on('ready', () => { this.emit('ready'); })
      .on('data', this.handleResponse.bind(this));
  }

  /**
   * Close the XAPI connection.
   *
   * @return {XAPI} - XAPI instance..
   */
  close() {
    this.backend.close();
    return this;
  }

  /**
   * Executes the command specified by the given path.
   *
   * @example
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
   *
   * @param {Array|string} path - Path to command node.
   * @param {Object} [params] - Object containing named command arguments.
   * @param {string} [body] - Multi-line body for commands requiring it.
   * @return {Promise} - Resolved with the command response when ready.
   */
  command(path, params, body) {
    const apiPath = normalizePath(path).join('/');
    const method = `xCommand/${apiPath}`;
    const executeParams = body === undefined ? params : Object.assign({ body }, params);
    return this.execute(method, executeParams);
  }

  /** @private */
  handleResponse(response) {
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

  /** @private */
  nextRequestId() {
    const requestId = this.requestId;
    this.requestId += 1;
    return requestId.toString();
  }

  /**
   * Execute the given JSON-RPC request on the backend.
   *
   * @example
   * xapi.execute('xFeedback/Subscribe', {
   *   Query: ['Status', 'Audio'],
   * });
   *
   * @param {String} method - Name of RPC method to invoke.
   * @param {Object} [params] - Parameters to add to the request.
   * @return {Promise} - Resolved with the command response.
   */
  execute(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId();
      const request = rpc.createRequest(id, method, params);
      this.backend.execute(request);
      this.requests[id] = { resolve, reject };
    });
  }
}
