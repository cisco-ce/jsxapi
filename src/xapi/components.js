import normalizePath from './normalizePath';
import { Listenable, Gettable, Settable, mix } from './mixins';


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
  prefix = ''

  /**
   * @param {XAPI} xapi - XAPI instance.
   */
  constructor(xapi) {
    /**
     * @type {XAPI}
     */
    this.xapi = xapi;
  }

  /**
   * Normalizes a path including the component prefix.
   *
   * @param {Array|string} path - Normalize an XAPI path.
   * @return {Array} - Normalized path.
   */
  normalizePath(path) {
    const normalized = normalizePath(path);
    const { prefix } = this;
    return !prefix ? normalized : [prefix].concat(normalized);
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
export class Config extends mix(Component, Listenable, Gettable, Settable) {
  prefix = 'Configuration'
}


/**
 * Interface to XAPI events.
 *
 * @extends {Component}
 * @extends {Listenable}
 */
export class Event extends mix(Component, Listenable) {
  prefix = 'Event'
}


/**
 * Interface to XAPI statuses.
 *
 * @extends {Component}
 * @extends {Listenable}
 * @extends {Gettable}
 */
export class Status extends mix(Component, Listenable, Gettable) {
  prefix = 'Status'
}
