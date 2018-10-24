import { EventEmitter } from 'events';

import log from '../log';
import * as rpc from '../xapi/rpc';


/**
 * @external {EventEmitter} https://nodejs.org/api/events.html#events_class_eventemitter
 */


/**
 * Backend abstract class.
 *
 * @extends {EventEmitter}
 * @interface
 *
 * @example <caption>Custom backend implementation</caption>
 * class MyBackend extends Backend {
 *   constructor(transport) {
 *     this._transport = transport.on('data', this._recvMsg.bind(this));
 *   }
 *
 *   _recvMsg(message) {
 *     const id = ... // determine request id
 *     const result = ... // process message
 *     this.onResult(id, result);
 *   }
 *
 *   // `command` is passed by the method handler, e.g. `xCommand()`.
 *   send(id, command) {
 *     const message = ... // use id and command to construct message
 *     this._transport.send(message);
 *   }
 *
 *   // this is dispatched by .execute()
 *   'xCommand()'(request, send) {
 *     const command = ... // do stuff with request
 *     return send(command).then(result => {
 *       // process result
 *     });
 *   }
 * }
 */
export default class Backend extends EventEmitter {
  constructor() {
    super();
    this.requests = {};
  }

  /**
   * Close the backend connection and free up resources. The backend should not
   * be used after it is closed and a new instance is required in order
   * re-initialize.
   */
  close() { // eslint-disable-line class-methods-use-this
  }

  /**
   * Promise that is resolved once the backend is ready to receive commands.
   *
   * @return {Promise} - Promised resolved when the backend is ready.
   */
  get isReady() { // eslint-disable-line class-methods-use-this
    return Promise.resolve(true);
  }

  /**
   * Default method handler. Called if there isn't a handler specified for the
   * method type. The default handler dies unless it is overridden in a sub-class.
   *
   * @param {Object} request - JSON-RPC request
   * @param {Function} send - Function for dispatching the request to the backend service.
   */
  defaultHandler({ method }, send) { // eslint-disable-line class-methods-use-this, no-unused-vars
    return Promise.reject(new Error(`Invalid request method: ${method}`));
  }

  /**
   * Determine the type of the JSON-RPC request. The type is used for
   * dispatching the request to the different rpc handlers. Sub-classes may
   * override this for custom routing behavior.
   *
   * @param {Object} request - JSON-RPC request
   * @return {string} - Request method type.
   */
  getRequestType({ method }) { // eslint-disable-line class-methods-use-this
    if (method.startsWith('xCommand')) {
      return 'xCommand';
    }
    return method;
  }

  /**
   * Transmit the given JSON-RPC payload to the backend service. The request
   * type is determined using {@link getRequestType} and the request is
   * delegated to method handlers, if they are defined for the given type. The
   * default handler ({@link defaultHandler}) is used if there is no handler
   * for the request type.
   *
   * Method handlers are defined on the sub-class, using the naming convention of
   * `<requestType>()` (notice the '()' suffix). Method handlers are passed the
   * request object and a `send` function to invoke for the request.
   *
   * @param {Object} request - JSON-RPC request to execute agains the backend service.
   * @return {Promise} - Promise resolved when response is received.
   */
  execute(request) {
    const { id } = request;
    const type = this.getRequestType(request);
    const handlerName = `${type}()`;
    const handler = typeof this[handlerName] === 'function'
      ? this[handlerName]
      : this.defaultHandler;

    return this.isReady
      .then(() => {
        const promise = new Promise((resolve) => {
          this.requests[id] = resolve;
        });
        const sender = (cmd, body) => {
          this.send(id, cmd, body);
          return promise;
        };
        log.debug('[backend] (request):', request);
        const result = handler.call(this, request, sender);
        return Promise.resolve(result);
      })
      .then((result) => {
        log.debug('[backend] (success):', result);
        this.emit('data', rpc.createResponse(id, result));
      })
      .catch((error) => {
        log.debug('[backend] (failure):', error);
        this.emit('data', rpc.createErrorResponse(id, error));
      });
  }

  /**
   * Called when receiving feedback from the backend service.
   *
   * @param {Object} result - JSON-RPC params data for the feedback event.
   */
  onFeedback(result) {
    this.emit('data', rpc.createRequest(null, 'xFeedback/Event', result));
  }

  /**
   * Called when the backend is done processing the response and ready to hand
   * it over to the XAPI frontend. The response should be a valid JSON-RPC
   * response.
   *
   * @param {string} id - Request id of the JSON-RPC request.
   * @param {Object} result - Result from the backend service.
   */
  onResult(id, result) {
    if (id) {
      const resolve = this.requests[id];
      delete this.requests[id];
      resolve(result);
    }
  }

  /**
   * Used to send the actual command to the backend service. The command
   * should be generated by the method handler and .
   *
   * @param {string} id - The request id.
   * @param {Array|Object|number|string} command - Command from method handler.
   * @abstract
   */
  send(id, command) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('Backend class must override .send()');
  }
}
