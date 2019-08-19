import { EventEmitter } from 'events';

import log from '../log';

import XAPI from '.';
import normalizePath from './normalizePath';
import { Handler, Listener, Path } from './types';

/**
 * Group feedback deregister handlers for bookkeeping.
 */
export class FeedbackGroup {
  private handlers: Handler[];

  constructor(handlers: Handler[]) {
    this.handlers = handlers;
  }

  /**
   * Add a deregister handler function to the feedback group.
   *
   * @param {function()} handler - Handler to add to the group.
   * @return {FeedbackGroup} - this for chaining.
   */
  public add(handler: Handler) {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Remove a deregister handler function from the feedback group.
   *
   * @param {function()} handler - Handler to remove from the group.
   * @return {FeedbackGroup} - this for chaining.
   */
  public remove(handler: Handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
    return this;
  }

  /**
   * Call the deregister handler functions associated with this group.
   *
   * @return {FeedbackGroup} - this for chaining.
   */
  public off() {
    this.handlers.forEach((handler) => {
      handler();
    });
    this.handlers = [];
    return this;
  }
}

function defaultInterceptor<T>(payload: T, emit: (payload: T) => void) {
  emit(payload);
}

function dispatch(
  feedback: Feedback,
  data: any,
  root = data,
  path: string[] = [],
) {
  if (Array.isArray(data)) {
    data.forEach((child) => {
      dispatch(feedback, child, root, path);
      dispatch(feedback, child, root, path.concat(child.id));
    });
    return;
  }

  const emitPath = path.join('/').toLowerCase();
  feedback.eventEmitter.emit(emitPath, data, root);

  if (typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      dispatch(feedback, data[key], root, path.concat(key));
    });
  }
}

/**
 * Feedback handler for the XAPI.
 *
 * @example <caption>Register a feedback listener</caption>
 * xapi.feedback.on('Status/Audio/Volume', data => {
 *   console.log(`Received feedback data: ${data}`);
 * });
 *
 * @example <caption>Get the feedback root payload</caption>
 * xapi.feedback.on('Status/Audio/Volume', (data, payload) => {
 *   console.log(`System volume changed to: ${data}`);
 *   JSON.stringify(payload) // => { Status: { Audio: { Volume: data } } }
 * });
 *
 * @example <caption>Listen to array elements</caption>
 * xapi.feedback.on('Status/Call[42]/Status', callStatus => {
 *   console.log(`Call status for call number 42 is: ${callStatus}`);
 * });
 *
 * @example <caption>Bundle feedback listeners for easy unsubscription</caption>
 * const feedbackGroup = xapi.feedback.group([
 *   xapi.status.on('Audio/Volume', volumeListener),
 *   xapi.status.on('Call', callListener),
 * ]);
 *
 * // Disable feedback listening for all listeners of the group.
 * feedbackGroup.off();
 *
 * @example <caption>Register listener with Array path</caption>
 * const off = xapi.feedback.on('Status/Audio/Volume', listener);
 * off(); // De-register feedback
 */
export default class Feedback {
  /**
   * @param {XAPI} xapi - XAPI instance.
   * @param {function} interceptor - Feedback interceptor.
   */
  public readonly eventEmitter = new EventEmitter();
  private subscriptions = [];
  constructor(readonly xapi: XAPI, readonly interceptor = defaultInterceptor) {}

  /**
   * Registers a feedback listener with the backend service which is invoked
   * when there is feedback matching the subscription query.
   *
   * @param {Array|string} path - Path to subscribe to
   * @param {function} listener - Listener invoked on feedback
   */
  public on(path: Path, listener: Listener) {
    log.info(`new feedback listener on: ${path}`);
    const eventPath = normalizePath(path)
      .join('/')
      .toLowerCase();

    this.eventEmitter.on(eventPath, listener);

    const registration = this.xapi.execute<{ Id: string }>('xFeedback/Subscribe', {
      Query: normalizePath(path),
    });

    const off = () => {
      registration.then(({ Id }) => {
        this.xapi.execute('xFeedback/Unsubscribe', { Id });
      });

      this.eventEmitter.removeListener(eventPath, listener);
    };

    return off;
  }

  /**
   * Registers a feedback listener similar to {@link on}, but the subscription
   * is removed after the first invocation of the listener.
   *
   * @param {Array|string} path - Path to subscribe to
   * @param {function} listener - Listener invoked on feedback
   */
  public once<T = any>(path: Path, listener: Listener) {
    let off: () => void | undefined;
    const wrapped = (ev: T, root: any) => {
      if (typeof off === 'function') {
        off();
      }
      listener.call(this, ev, root);
    };
    wrapped.listener = listener;
    off = this.on(path, wrapped);
    return off;
  }

  /**
   * Remove feedback registration.
   *
   * @deprecated use deactivation handler from `.on()` and `.once()` instead.
   */
  // eslint-disable-next-line class-methods-use-this
  public off() {
    throw new Error(
      '.off() is deprecated. Use return value deactivate handler from .on() instead.',
    );
  }

  /**
   * Dispatches feedback data to the registered handlers.
   *
   * @param {Object} data - JSON data structure of feedback data.
   * @return {FeedbackHandler} - Returns self for chaining.
   */
  public dispatch(data: any) {
    this.interceptor(data, (d = data) => dispatch(this, d));
    return this;
  }

  /**
   * Creates a grouper object which tracks which tracks the feedback paths and
   * listeners being added to it.
   *
   * @return {FeedbackGroup} - Proxy object for xapi.feedback
   *
   * @example <caption>Bundle feedback listeners for easy unsubscription</caption>
   * // Create a group
   * const group = xapi.feedback.group([
   *   xapi.status.on('Audio Volume', (volume) => {
   *     // ...
   *   }),
   *   xapi.config.on('Audio DefaultVolume', (volume) => {
   *     // ...
   *   }),
   * ]);
   *
   * const handler = xapi.status.on('Call', (call) => { ... });
   *
   * // Add handler to the group
   * group.add(handler);
   *
   * // Remove handler from the group
   * group.remove(handler);
   *
   * // Unregister from all feedback handlers
   * group.off();
   */
  // eslint-disable-next-line class-methods-use-this
  public group(handlers: Handler[]) {
    return new FeedbackGroup(handlers);
  }
}
