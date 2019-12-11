import XAPI from '.';
import { Registration } from './feedback';
import { Gettable, Listenable, mix, Settable } from './mixins';
import normalizePath from './normalizePath';
import { Listener, Path } from './types';

/**
 * Common base class for XAPI section types (commands, configs, events, statuses).
 */
class Component {
  /**
   * Prefix to add to all paths for the component.
   */
  public prefix = '';

  constructor(public readonly xapi: XAPI) {}

  /**
   * Normalizes a path including the component prefix.
   */
  public normalizePath(path: Path) {
    const normalized = normalizePath(path);
    const { prefix } = this;
    return !prefix
      ? normalized
      : ([prefix] as Array<string | number>).concat(normalized);
  }
}

/**
 * Interface to XAPI configurations.
 */
export class Config extends mix(Component, Listenable, Gettable, Settable)
  implements Component, Listenable, Gettable, Settable {
  public prefix = 'Configuration';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string | number>;

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;

  public get!: <T = any>(path: Path) => Promise<T>;
  public set!: (path: Path, value: number | string) => Promise<any>;

  constructor(public readonly xapi: XAPI) {
    super();
  }
}

/**
 * Interface to XAPI events.
 */
export class Event extends mix(Component, Listenable)
  implements Component, Listenable {
  public prefix = 'Event';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string | number>;

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;

  constructor(readonly xapi: XAPI) {
    super();
  }
}

/**
 * Interface to XAPI statuses.
 */
export class Status extends mix(Component, Listenable, Gettable)
  implements Component, Listenable, Gettable {
  public prefix = 'Status';

  // fake mixins
  public normalizePath!: (path: Path) => Array<string | number>;

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;

  public get!: <T = any>(path: Path) => Promise<T>;

  constructor(public readonly xapi: XAPI) {
    super();
  }
}
