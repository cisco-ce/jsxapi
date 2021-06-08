/*
 * This module basically patches the `loglevel` library with some niceities for
 * named loggers. Named loggers prefix the log output with their log name and
 * their level can be set independently.
 */

import loglevel from 'loglevel';

if (!(loglevel as any).isPatched) {
  const origMethodFactory = loglevel.methodFactory;
  const loggers = new Set<string>();

  /*
   * Bless the `log` object with custom plugins
   */
  Object.assign(loglevel, {
    isPatched: true,

    methodFactory(methodName: string, logLevel: any, loggerName: string) {
      if (loggerName) {
        loggers.add(loggerName);
      }
      const rawMethod = origMethodFactory(methodName, logLevel, loggerName);
      return (...args: any[]) => {
        rawMethod(`[${loggerName || 'root'}]`, ...args);
      };
    },

    /*
     * Returns a list of logger names, excluding the root logger.
     */
    getLoggers() {
      return Array.from(loggers);
    },

    setGlobalLevel(level: loglevel.LogLevelDesc) {
      const allLoggers = [loglevel].concat(
        (loglevel as any)
          .getLoggers()
          .map((name: string) => loglevel.getLogger(name)),
      );

      allLoggers.forEach((logger) => {
        logger.setLevel(level);
      });
    },

    setLevelTrace() {
      (loglevel as any).setGlobalLevel('trace');
    },
    setLevelDebug() {
      (loglevel as any).setGlobalLevel('debug');
    },
    setLevelInfo() {
      (loglevel as any).setGlobalLevel('info');
    },
    setLevelWarn() {
      (loglevel as any).setGlobalLevel('warn');
    },
    setLevelError() {
      (loglevel as any).setGlobalLevel('error');
    },
  });

  // Required to apply the plugin to log
  loglevel.setLevel(loglevel.getLevel());
}

export default loglevel.getLogger('jsxapi');
