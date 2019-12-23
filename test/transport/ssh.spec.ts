import * as sinon from 'sinon';
import { expect } from 'chai';
import { Client } from 'ssh2';
import { Duplex } from 'stream';

import logger from '../../src/log';
import connectSSH from '../../src/transport/ssh';

describe('connectSSH', () => {
  let client: Client;
  let dataSpy: sinon.SinonSpy;
  let errorSpy: sinon.SinonSpy;
  let closeSpy: sinon.SinonSpy;
  let clientConnectStub: sinon.SinonStubbedMember<Client["connect"]>;
  let clientShellStub: sinon.SinonStubbedMember<Client["shell"]>;
  let clientExecStub: sinon.SinonStubbedMember<Client["exec"]>;
  let clientEndStub: sinon.SinonStubbedMember<Client["end"]>;

  beforeEach(() => {
    logger.disableAll();

    client = new Client();
    clientConnectStub = sinon.stub(client, 'connect');
    clientShellStub = sinon.stub(client, 'shell');
    clientExecStub = sinon.stub(client, 'exec');
    clientEndStub = sinon.stub(client, 'end');

    dataSpy = sinon.spy();
    errorSpy = sinon.spy();
    closeSpy = sinon.spy();
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

      expect(errorSpy).to.have.been.calledOnce();
      expect(errorSpy.firstCall).to.have.been.calledWith('client-error');
    });

    it('on shell error', () => {
      const error = new Error('some error');
      clientShellStub.callsArgWith(1, error);

      client.emit('ready');

      expect(errorSpy).to.have.been.calledOnce();
      expect(errorSpy.firstCall).to.have.been.calledWith(error);
    });

    it('on ssh stream error', () => {
      const error = new Error('some error');
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.callsArgWith(1, null, sshStream);

      client.emit('ready');
      sshStream.emit('error', error);

      expect(errorSpy).to.have.been.calledOnce();
      expect(errorSpy.firstCall).to.have.been.calledWith(error);
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

      expect(closeSpy).to.have.been.calledOnce();
    });

    it('on ssh stream close', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.callsArgWith(1, null, sshStream);

      client.emit('ready');
      sshStream.emit('close');

      expect(closeSpy).to.have.been.calledOnce();
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
      clientShellStub.callsArgWith(1, null, sshStream);

      client.emit('ready');
      sshStream.push('foo bar baz');

      expect(dataSpy).to.have.been.calledOnce();
      expect(dataSpy.firstCall.args[0].toString()).to.equal('foo bar baz');
    });

    it('"close" is emitted on stream end', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.callsArgWith(1, null, sshStream);

      client.emit('ready');
      sshStream.emit('close');

      expect(closeSpy).to.have.been.calledOnce();
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
      clientShellStub.callsArgWith(1, null, sshStream);
      clientExecStub.callsArgWith(1, null, binaryStream);

      client.emit('ready');
      sshStream.push('boing boing');
      binaryStream.push('foo bar baz');

      expect(dataSpy).to.have.been.calledOnce();
      expect(dataSpy.firstCall.args[0].toString()).to.equal('foo bar baz');
    });

    it('correct command is sent', () => {
      const sshStream = new Duplex({ read: () => {} });
      clientShellStub.callsArgWith(1, null, sshStream);

      client.emit('ready');

      expect(clientExecStub).to.have.been.calledOnce();
      expect(clientExecStub.firstCall.args[0].toString()).to.equal('/bin/foo');
    });
  });

  it('does not pass on password to .connect()', () => {
    connectSSH({
      client,
      username: 'admin',
      password: 'password',
    });

    const options = clientConnectStub.firstCall.args[0];
    expect(options).to.have.property('username', 'admin');
    expect(options).to.not.have.property('password');
  });

  it('closing with ".close()" does not emit error', () => {
    const transport = connectSSH({
      client,
    });

    const sshStream = new Duplex({ read: () => {} });
    clientShellStub.callsArgWith(1, null, sshStream);
    clientEndStub.callsFake(() => {
      sshStream.emit('end');
    });
    transport.on('error', errorSpy);

    client.emit('ready');
    transport.close();

    expect(errorSpy).to.have.not.been.calledOnce();
  });

  it('remotely ended ssh stream emits errors', () => {
    const transport = connectSSH({
      client,
    });

    const sshStream = new Duplex({ read: () => {} });
    clientShellStub.callsArgWith(1, null, sshStream);
    transport.on('error', errorSpy);
    client.emit('ready');

    sshStream.emit('end');

    expect(errorSpy).to.have.been.calledOnce();
    expect(errorSpy.firstCall).to.have.been.calledWith(
      'Connection terminated remotely',
    );
  });
});
