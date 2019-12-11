import XAPI from '.';
import normalizePath from './normalizePath';
import { Listener, Path } from './types';

/**
 * Mixin for XAPI sections that can trigger feedback.
 */
export class Listenable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;

  /**
   * Register a new listener on the given path.
   *
   * @param path Path to XAPI entry.
   * @param listener Callback handler called on changes.
   * @typeparam T Event type.
   * @return Handler to deregister the feedback registration.
   */
  public on<T = any>(path: Path, listener: Listener<T>) {
    return this.xapi.feedback.on(this.normalizePath(path) as any, listener);
  }

  /**
   * Register a new listener on the given path, de-register
   * after the first change happened.
   *
   * @param path Path to XAPI entry.
   * @param listener Callback handler called on changes.
   * @typeparam T Event type.
   * @return Handler to deregister the feedback registration.
   */
  public once<T = any>(path: Path, listener: Listener<T>) {
    return this.xapi.feedback.once(this.normalizePath(path) as any, listener);
  }

  /**
   * De-register the given listener on the given path.
   *
   * @deprecated Use deactivation handler from `.on()` and `.once()` instead.
   */
  public off() {
    this.xapi.feedback.off();
  }
}

/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 */
export class Gettable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;
  /**
   * Gets the value of the given path.
   *
   * ```typescript
   * xapi.status
   *   .get('Audio Volume')
   *   .then((volume) => { console.log(volume); });
   * ```
   *
   * ```typescript
   * xapi.config
   *   .get('Audio DefaultVolume')
   *   .then((volume) => { console.log(volume); });
   * ```
   *
   * @param path Path to configuration node.
   * @typeparam T The return type of the get request.
   * @return Resolved to the configuration value when ready.
   */
  public get<T = any>(path: Path): Promise<T> {
    return this.xapi.execute('xGet', {
      Path: this.normalizePath(path),
    });
  }
}

/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 */
export class Settable {
  public xapi!: XAPI;
  public normalizePath!: typeof normalizePath;
  /**
   * Sets the path to the given value.
   *
   * ```typescript
   * xapi
   *   .config.set('SystemUnit Name', 'My System');
   * ```
   *
   * @param path Path to status node.
   * @param value Configuration value.
   * @return Resolved to the status value when ready.
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
 * @param Base Base class to extend.
 * @param Mixins Mixins to apply.
 * @return New ad-hoc base class with mixins applied.
 */
export function mix(Base: any, ...Mixins: any[]) {
  class Class extends Base {}

  Mixins.forEach((mixin) => {
    Object.getOwnPropertyNames(mixin.prototype)
      .map((key) => [key, mixin.prototype[key]])
      .filter(([, v]) => typeof v === 'function' && v !== 'constructor')
      .forEach(([name, method]) => {
        Class.prototype[name] = method;
      });
  });

  return Class as any;
}
