import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import connect, { globalDefaults } from '../src/connect';
import log from '../src/log';

describe('connect()', () => {
  let initBackend: sinon.SinonStub;

  beforeEach(() => {
    initBackend = sinon.stub();
    initBackend.returns(new EventEmitter());
  });

  afterEach(() => {
    log.disableAll(); // connect sets log-level
  });

  describe('args', () => {
    it('throws with no arguments', () => {
      const doConnect = connect(initBackend, {}) as any;
      expect(() => doConnect()).to.throw(/invalid arguments/i);
    });

    it('allows invoking with a single string URL', () => {
      const doConnect = connect(initBackend, {});

      doConnect('ssh://host.example.com');

      expect(initBackend).to.have.been.calledWith({
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

      expect(initBackend).to.have.been.calledWith({
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

      expect(initBackend).to.have.been.calledWith({
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

      expect(initBackend).to.have.been.calledWith({
        ...globalDefaults,
        port: 80,
        protocol: 'ws:',
        username: 'integrator',
      });
    });
  });
});
