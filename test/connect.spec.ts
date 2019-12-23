import { EventEmitter } from 'events';
import connect, { globalDefaults } from '../src/connect';
import log from '../src/log';

describe('connect()', () => {
  let initBackend: jest.Mock;

  beforeEach(() => {
    initBackend = jest.fn();
    initBackend.mockReturnValue(new EventEmitter());
  });

  afterEach(() => {
    log.disableAll(); // connect sets log-level
  });

  describe('args', () => {
    it('throws with no arguments', () => {
      const doConnect = connect(initBackend, {}) as any;
      expect(() => doConnect()).toThrow(/invalid arguments/i);
    });

    it('allows invoking with a single string URL', () => {
      const doConnect = connect(initBackend, {});

      doConnect('ssh://host.example.com');

      expect(initBackend).toHaveBeenCalledWith({
        ...globalDefaults,
        host: 'host.example.com',
        protocol: 'ssh:',
      });
    });

    it('allows invoking with a single object', () => {
      const doConnect = connect(initBackend, {
        protocol: 'ssh:',
      });

      doConnect({
        host: 'host.example.com',
      });

      expect(initBackend).toHaveBeenCalledWith({
        ...globalDefaults,
        host: 'host.example.com',
        protocol: 'ssh:',
      });
    });
  });

  describe('options', () => {
    it('allows passing defaults', () => {
      const doConnect = connect(initBackend, {
        protocol: 'ssh:',
      });

      doConnect('');

      expect(initBackend).toHaveBeenCalledWith({
        ...globalDefaults,
        protocol: 'ssh:',
      });
    });
    it('merges defaults and passed options', () => {
      const doConnect = connect(initBackend, {
        port: 22,
        protocol: 'ssh:',
        username: 'integrator',
      });

      doConnect({
        port: 80,
        protocol: 'ws:',
      });

      expect(initBackend).toHaveBeenCalledWith({
        ...globalDefaults,
        port: 80,
        protocol: 'ws:',
        username: 'integrator',
      });
    });
  });
});
