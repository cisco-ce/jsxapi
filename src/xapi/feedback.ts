import { EventEmitter } from 'events';

import log from '../log';

import XAPI from '.';
import normalizePath from './normalizePath';
import { Handler, Listener, Path } from './types';

/**
 * A function used to inspect and emit feedback data.
 *
 * The interceptor is free to change feedback payloads or discard them
 * entirely.
 */
export type FeedbackInterceptor =
  /**
   * @param payload The feedback payload.
   * @param emit Function to dispatch a payload.
   */
  (payload: any, emit: (payload: any) => void) => void;

/**
 * Type representing a feedback id.
 */
export interface FeedbackId {
  Id: number;
}

/**
 * Type for a feedback registration request.
 */
export interface Registration {
  /**
   * De-register the feedback registration.
   */
  (): void;

  /**
   * Promise resolved with a feedback id on successful registration.
   */
  registration: Promise<FeedbackId>;
}

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
   * @param handler - Handler to add to the group.
   * @return - this for chaining.
   */
  public add(handler: Handler) {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Remove a deregister handler function from the feedback group.
   *
   * @param handler - Handler to remove from the group.
   * @return - this for chaining.
   */
  public remove(handler: Handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
    return this;
  }

  /**
   * Call the deregister handler functions associated with this group.
   *
   * @return - this for chaining.
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
  feedback.eventEmitter.emit(emitPath, data, root, root.Id);

  if (typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      dispatch(feedback, data[key], root, path.concat(key));
    });
  }
}

/**
 * Feedback handler for the XAPI.
 *
 * ### Register a feedback listener
 *
 * ```typescript
 * xapi.feedback.on('Status/Audio/Volume', data => {
 *   console.log(`Received feedback data: ${data}`);
 * });
 * ```
 *
 * ### Get the feedback root payload
 *
 * ```typescript
 * xapi.feedback.on('Status/Audio/Volume', (data, payload) => {
 *   console.log(`System volume changed to: ${data}`);
 *   JSON.stringify(payload) // => { Status: { Audio: { Volume: data } } }
 * });
 * ```
 *
 * ### Listen to array elements
 *
 * ```typescript
 * xapi.feedback.on('Status/Call[42]/Status', callStatus => {
 *   console.log(`Call status for call number 42 is: ${callStatus}`);
 * });
 * ```
 *
 * ### Bundle feedback listeners for easy unsubscription
 *
 * ```typescript
 * const feedbackGroup = xapi.feedback.group([
 *   xapi.status.on('Audio/Volume', volumeListener),
 *   xapi.status.on('Call', callListener),
 * ]);
 *
 * // Disable feedback listening for all listeners of the group.
 * feedbackGroup.off();
 * ```
 *
 * ### Register listener with Array path
 *
 * ```typescript
 * const off = xapi.feedback.on('Status/Audio/Volume', listener);
 * off(); // De-register feedback
 * ```
 */
export default class Feedback {
  /**
   * @param xapi XAPI instance.
   * @param interceptor Feedback interceptor.
   */
  public readonly eventEmitter = new EventEmitter();
  constructor(readonly xapi: XAPI, readonly interceptor: FeedbackInterceptor = defaultInterceptor) {}

  /**
   * Registers a feedback listener with the backend service which is invoked
   * when there is feedback matching the subscription query.
   *
   * @param path Path to subscribe to.
   * @param listener Listener invoked on feedback.
   * @return Feedback cancellation function.
   */
  public on(path: Path, listener: Listener): Registration {
    log.info(`new feedback listener on: ${path}`);
    const eventPath = normalizePath(path)
      .join('/')
      .toLowerCase();

    const registration = this.xapi.execute<FeedbackId>('xFeedback/Subscribe', {
      Query: normalizePath(path),
    });

    let wrapper: <T = any>(ev: T, root: any, id?: number) => void;

    const idP = registration.then(({ Id }) => {
      wrapper = (ev, root, id) => {
        if (typeof id !== 'undefined' && id !== Id) {
          return;
        }
        listener(ev, root);
      };
      this.eventEmitter.on(eventPath, wrapper);
      return Id;
    });

    const off = () => {
      if (!wrapper) {
        return;
      }

      idP.then((Id) => {
        this.xapi.execute('xFeedback/Unsubscribe', { Id });
      });

      this.eventEmitter.removeListener(eventPath, wrapper);
    };

    off.registration = registration;
    return off;
  }

  /**
   * Registers a feedback listener similar to {@link on}, but the subscription
   * is removed after the first invocation of the listener.
   *
   * @param path Path to subscribe to.
   * @param listener Listener invoked on feedback.
   * @return Feedback cancellation function.
   */
  public once<T = any>(path: Path, listener: Listener): Registration {
    let off: Registration;
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
  public off() {
    throw new Error(
      '.off() is deprecated. Use return value deactivate handler from .on() instead.',
    );
  }

  /**
   * Dispatches feedback data to the registered handlers.
   *
   * @param data JSON data structure of feedback data.
   * @return Returns self for chaining.
   */
  public dispatch(data: any) {
    this.interceptor(data, (d = data) => dispatch(this, d));
    return this;
  }

  /**
   * Creates a grouper object which tracks which tracks the feedback paths and
   * listeners being added to it.
   *
   * ### Bundle feedback listeners for easy unsubscription
   *
   * ```typescript
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
   * ```
   *
   * @return Proxy object for xapi.feedback.
   */
  public group(handlers: Handler[]) {
    return new FeedbackGroup(handlers);
  }
}
