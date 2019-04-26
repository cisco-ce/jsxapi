import XAPI from '.';
import { Gettable, Listenable, mix, Settable } from './mixins';
import normalizePath from './normalizePath';
import { Listener, Path } from './types';

/**
 * Common base class for XAPI section types (commands, configs, events, statuses).
 *
 * @interface
 */
class Component {
  /**
   * Prefix to add to all paths for the component.
   *
   * @type {string}
   */
  public prefix = '';

  /**
   * @param {XAPI} xapi - XAPI instance.
   */
  constructor(readonly xapi: XAPI) {}
    /**
     * @type {XAPI}
     */

  /**
   * Normalizes a path including the component prefix.
   *
   * @param {Array|string} path - Normalize an XAPI path.
   * @return {Array} - Normalized path.
   */
  public normalizePath(path: Path) {
    const normalized = normalizePath(path);
    const { prefix } = this;
    return !prefix ? normalized : ([prefix] as Array<string | number>).concat(normalized);
  }
}


/**
 * Interface to XAPI configurations.
 *
 * @extends {Component}
 * @extends {Listenable}
 * @extends {Gettable}
 * @extends {Settable}
 */
export class Config extends mix(Component, Listenable, Gettable, Settable)
                    implements Component, Listenable, Gettable, Settable {
  public prefix = 'Configuration';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string|number>;

  public on!: (path: Path, listener: Listener) => () => void;
  public once!: (path: Path, listener: Listener) => () => void;
  public off!: () => void;

  public get!: (path: Path) => Promise<any>;
  public set!: (path: Path, value: number | string) => Promise<any>;

  constructor(readonly xapi: XAPI) { super(); }
}


/**
 * Interface to XAPI events.
 *
 * @extends {Component}
 * @extends {Listenable}
 */
export class Event extends mix(Component, Listenable) implements Component, Listenable {
  public prefix = 'Event';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string|number>;

  public on!: (path: Path, listener: Listener) => () => void;
  public once!: (path: Path, listener: Listener) => () => void;
  public off!: () => void;

  constructor(readonly xapi: XAPI) { super(); }
}


/**
 * Interface to XAPI statuses.
 *
 * @extends {Component}
 * @extends {Listenable}
 * @extends {Gettable}
 */
export class Status extends mix(Component, Listenable, Gettable) implements Component, Listenable, Gettable {
  public prefix = 'Status';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string|number>;

  public on!: (path: Path, listener: Listener) => () => void;
  public once!: (path: Path, listener: Listener) => () => void;
  public off!: () => void;

  public get!: (path: Path) => Promise<any>;

  constructor(readonly xapi: XAPI) { super(); }
}
