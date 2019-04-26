import XAPI from '.';
import normalizePath from './normalizePath';
import { Listener, Path } from './types';

/**
 * Mixin for XAPI sections that can trigger feedback.
 *
 * @interface
 */
export class Listenable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;

  /**
   * Register a new listener on the given path.
   *
   * @param {string} path - Path to XAPI entry.
   * @param {function(data: Object): null} listener - Callback handler called on changes.
   * @return {function()} - Handler to deregister the feedback registration.
   */
  public on(path: Path, listener: Listener) {
    return this.xapi.feedback.on(this.normalizePath(path) as any, listener);
  }

  /**
   * Register a new listener on the given path, de-register
   * after the first change happened.
   *
   * @param {string} path - Path to XAPI entry.
   * @param {function(data: Object): null} listener - Callback handler called on changes.
   * @return {Object} - Handler to deregister the feedback registration.
   */
  public once(path: Path, listener: Listener) {
    return this.xapi.feedback.once(this.normalizePath(path) as any, listener);
  }


  /**
   * De-register the given listener on the given path.
   *
   * @deprecated use deactivation handler from `.on()` and `.once()` instead.
   */
  public off() {
    this.xapi.feedback.off();
  }
}


/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 *
 * @interface
 */
export class Gettable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;
  /**
   * Gets the value of the given path.
   *
   * @example
   * xapi.status
   *   .get('Audio Volume')
   *   .then((volume) => { console.log(volume); });
   *
   * @example
   * xapi.config
   *   .get('Audio DefaultVolume')
   *   .then((volume) => { console.log(volume); });
   *
   * @param {string} path - Path to configuration node.
   * @return {Promise} - Resolved to the configuration value when ready.
   */
  public get(path: Path) {
    return this.xapi.execute('xGet', {
      Path: this.normalizePath(path),
    });
  }
}


/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 *
 * @interface
 */
export class Settable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;
  /**
   * Sets the path to the given value.
   *
   * @example
   * xapi
   *   .config.set('SystemUnit Name', 'My System');
   *
   * @param {string} path - Path to status node.
   * @param {number|string} value - Configuration value.
   * @return {Promise} - Resolved to the status value when ready.
   */
  public set(path: Path, value: number | string) {
    return this.xapi.execute('xSet', {
      Path: this.normalizePath(path),
      Value: value,
    });
  }
}


/**
 * Extend {Base} class and apply {Mixins}.
 *
 * @param {Object} Base - Base class to extend.
 * @param {Array} Mixins - Mixins to apply.
 * @return Object - New ad-hoc base class with mixins applied.
 */
export function mix(Base: any, ...Mixins: any[]) {
  class Class extends Base {}

  Mixins.forEach((mixin) => {
    Object
      .getOwnPropertyNames(mixin.prototype)
      .map((key) => [key, mixin.prototype[key]])
      .filter(([, v]) => typeof v === 'function' && v !== 'constructor')
      .forEach(([name, method]) => {
        Class.prototype[name] = method;
      });
  });

  return Class as any;
}

