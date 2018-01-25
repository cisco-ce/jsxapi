/*
 * This module basically patches the `loglevel` library with some niceities for
 * named loggers. Named loggers prefix the log output with their log name and
 * their level can be set independently.
 */

import loglevel from 'loglevel';


if (!loglevel.isPatched) {
  const origMethodFactory = loglevel.methodFactory;
  const loggers = new Set();


  /*
   * Bless the `log` object with custom plugins
   */
  Object.assign(loglevel, {
    isPatched: true,

    methodFactory(methodName, logLevel, loggerName) {
      if (loggerName) {
        loggers.add(loggerName);
      }
      const rawMethod = origMethodFactory(methodName, logLevel, loggerName);
      return (...args) => {
        rawMethod(`[${loggerName || 'root'}]`, ...args);
      };
    },

    /*
     * Returns a list of logger names, excluding the root logger.
     */
    getLoggers() {
      return [...loggers];
    },

    setGlobalLevel(level) {
      const allLoggers = [loglevel].concat(
        loglevel.getLoggers().map(name => loglevel.getLogger(name)));

      allLoggers.forEach((logger) => { logger.setLevel(level); });
    },

    setLevelTrace() { loglevel.setGlobalLevel('trace'); },
    setLevelDebug() { loglevel.setGlobalLevel('debug'); },
    setLevelInfo() { loglevel.setGlobalLevel('info'); },
    setLevelWarn() { loglevel.setGlobalLevel('warn'); },
    setLevelError() { loglevel.setGlobalLevel('error'); },
  });


  // Required to apply the plugin to log
  loglevel.setLevel(loglevel.getLevel());
}


export default loglevel.getLogger('jsxapi');
