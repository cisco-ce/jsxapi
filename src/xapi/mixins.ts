import XAPI from '.';
import { Registration } from './feedback';
import normalizePath from './normalizePath';
import { Listener, Path } from './types';

export type AnyConstructor<T = object> = new (...args: any[]) => T;

/**
 * Common base class for XAPI section types (commands, configs, events, statuses).
 */
export class Component {
  /**
   * Prefix to add to all paths for the component.
   */
  public prefix = '';

  constructor(public readonly xapi: XAPI) {}

  /**
   * Normalizes a path including the component prefix.
   *
   * @param path Path to normalize.
   * @return Normalized path.
   */
  public normalizePath(path: Path) {
    const normalized = normalizePath(path);
    const { prefix } = this;
    return !prefix
      ? normalized
      : ([prefix] as (string | number)[]).concat(normalized);
  }
}

/**
 * Mixin for XAPI sections that can trigger feedback.
 */
export interface Listenable<T> {
    on(path: Path, listener: Listener<T>): Registration;
    once(path: Path, listener: Listener<T>): Registration;
    off(): void;
}

export function Listenable<B extends AnyConstructor<Component>, T = any>(Base: B)
  : B & AnyConstructor<Listenable<T>>
{
  return class Child extends Base implements Listenable<T> {
    /**
     * Register a new listener on the given path.
     *
     * @param path Path to XAPI entry.
     * @param listener Callback handler called on changes.
     * @typeparam T Event type.
     * @return Handler to deregister the feedback registration.
     */
    public on(path: Path, listener: Listener<T>) {
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
    public once(path: Path, listener: Listener<T>) {
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
  };
}

export interface Gettable<T> {
    get(path: Path): Promise<T>;
}

/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 */
export function Gettable<B extends AnyConstructor<Component>, T = any>(Base: B)
  : B & AnyConstructor<Gettable<T>>
{
  return class Child extends Base implements Gettable<T> {
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
    public get(path: Path): Promise<T> {
      return this.xapi.execute('xGet', {
        Path: this.normalizePath(path),
      });
    }
  };
}

export interface Settable<T> {
  set(path: Path, value: T): Promise<unknown>;
}

/**
 * Mixin for XAPI sections that can hold a value that may be fetched.
 */
export function Settable<B extends AnyConstructor<Component>, T = number | string>(Base: B)
  : B & AnyConstructor<Settable<T>>
{
  return class Child extends Base implements Settable<T> {
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
    public set(path: Path, value: T) {
      return this.xapi.execute('xSet', {
        Path: this.normalizePath(path),
        Value: value,
      });
    }
  };
}
