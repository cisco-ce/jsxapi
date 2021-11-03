import { Registration } from './feedback';
import { Component, Gettable, Listenable, Settable } from './mixins';
import { Listener, Path } from './types';

/**
 * Interface to XAPI configurations.
 */
export class Config extends Listenable(Settable(Gettable(Component))) {
  public prefix = 'Configuration';

  // fake mixins
  public normalizePath!: (path: Path) => (string | number)[];

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;

  public get!: <T = any>(path: Path) => Promise<T>;
  public set!: (path: Path, value: number | string) => Promise<any>;
}

/**
 * Interface to XAPI events.
 */
export class Event extends Listenable(Component) {
  public prefix = 'Event';

  // fake mixins
  public normalizePath!: (path: Path) => (string | number)[];

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;
}

/**
 * Interface to XAPI statuses.
 */
export class Status extends Listenable(Gettable(Component)) {
  public prefix = 'Status';

  // fake mixins
  public normalizePath!: (path: Path) => (string | number)[];

  public on!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public once!: <T = any>(path: Path, listener: Listener<T>) => Registration;
  public off!: () => void;

  public get!: <T = any>(path: Path) => Promise<T>;
}
