import { Client } from 'ssh2';
import { Duplex } from 'stream';

import logger from '../../src/log';
import connectSSH from '../../src/transport/ssh';

describe('connectSSH', () => {
  let client: Client;
  let dataSpy: jest.Mock;
  let errorSpy: jest.Mock;
  let closeSpy: jest.Mock;
  let clientConnectStub: jest.SpyInstance;
  let clientShellStub: jest.SpyInstance;
  let clientExecStub: jest.SpyInstance;
  let clientEndStub: jest.SpyInstance;

  beforeEach(() => {
    logger.disableAll();

    client = new Client();
    clientConnectStub = jest.spyOn(client, 'connect').mockImplementation(() => { return client; });
    clientShellStub = jest.spyOn(client, 'shell').mockImplementation(() => { return client; });
    clientExecStub = jest.spyOn(client, 'exec').mockImplementation(() => { return client; });
    clientEndStub = jest.spyOn(client, 'end').mockImplementation(() => { return client; });

    dataSpy = jest.fn();
    errorSpy = jest.fn();
    closeSpy = jest.fn();
  });

  describe('emits "error" on transport stream', () => {
    beforeEach(() => {
      connectSSH({ client })
        .on('data', dataSpy)
        .on('error', errorSpy)
        .on('close', closeSpy);
    });

    it('on client error (extracts .level property)', () => {
      const error: any = new Error('some error');
      error.level = 'client-error';
      client.emit('error', error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]).toContain('client-error');
    });

    it('on shell error', () => {
      const error = new Error('some error');
      clientShellStub.mockImplementation((_, fn) => { fn(error); });

      client.emit('ready');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]).toContain(error);
    });

    it('on ssh stream error', () => {
      const error = new Error('some error');
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });

      client.emit('ready');
      sshStream.emit('error', error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]).toContain(error);
    });
  });

  describe('emits "close" on transport stream', () => {
    beforeEach(() => {
      connectSSH({ client })
        .on('data', dataSpy)
        .on('error', errorSpy)
        .on('close', closeSpy);
    });

    it('on client close', () => {
      client.emit('close');

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('on ssh stream close', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });

      client.emit('ready');
      sshStream.emit('close');

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stream', () => {
    beforeEach(() => {
      connectSSH({ client })
        .on('data', dataSpy)
        .on('error', errorSpy)
        .on('close', closeSpy);
    });

    it('passes through ssh stream data', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });

      client.emit('ready');
      sshStream.push('foo bar baz');

      expect(dataSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy.mock.calls[0][0].toString()).toEqual('foo bar baz');
    });

    it('"close" is emitted on stream end', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });

      client.emit('ready');
      sshStream.emit('close');

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('remote command', () => {
    beforeEach(() => {
      connectSSH({ client, command: '/bin/foo' })
        .on('data', dataSpy)
        .on('error', errorSpy)
        .on('close', closeSpy);
    });

    it('passes through ssh binary stream data', () => {
      const sshStream = new Duplex({ read: () => {} });
      const binaryStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });
      clientExecStub.mockImplementation((_, fn) => { fn(null, binaryStream); });

      client.emit('ready');
      sshStream.push('boing boing');
      binaryStream.push('foo bar baz');

      expect(dataSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy.mock.calls[0][0].toString()).toEqual('foo bar baz');
    });

    it('correct command is sent', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });

      client.emit('ready');

      expect(clientExecStub).toHaveBeenCalledTimes(1);
      expect(clientExecStub.mock.calls[0][0].toString()).toEqual('/bin/foo');
    });
  });

  it('does not pass on password to .connect()', () => {
    connectSSH({
      client,
      username: 'admin',
      password: 'password',
    });

    const options = clientConnectStub.mock.calls[0][0];
    expect(options).toHaveProperty('username', 'admin');
    expect(options).not.toHaveProperty('password');
  });

  it('closing with ".close()" does not emit error', () => {
    const transport = connectSSH({
      client,
    });

    const sshStream = new Duplex({ read: () => {} });
    clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });
    clientEndStub.mockImplementation(() => {
      sshStream.emit('end');
    });
    transport.on('error', errorSpy);

    client.emit('ready');
    transport.close();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('remotely ended ssh stream emits errors', () => {
    const transport = connectSSH({
      client,
    });

    const sshStream = new Duplex({ read: () => {} });
    clientShellStub.mockImplementation((_, fn) => { fn(null, sshStream); });
    transport.on('error', errorSpy);
    client.emit('ready');

    sshStream.emit('end');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContain(
      'Connection terminated remotely',
    );
  });
});
