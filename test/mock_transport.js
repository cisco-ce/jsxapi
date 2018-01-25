import { Duplex } from 'stream';


export default class MockTransport extends Duplex {
  constructor() {
    super();
    this.dataToPromiseMap = {};
    this.writeBuffer = [];
  }

  _read() {} // eslint-disable-line class-methods-use-this

  _write(data, enc, done) {
    this.writeBuffer.unshift(data.toString('utf8').trim());
    done();
  }

  // Intercept input passed to the backend so that we know which input has been
  // consumed. Map this to the promises from .send() and resolve them.
  stubBackend(backend) {
    const origMethod = backend.onTransportData;
    sinon.stub(backend, 'onTransportData').callsFake((data) => {
      const returnValue = origMethod.call(backend, data);
      if ({}.hasOwnProperty.call(this.dataToPromiseMap, data)) {
        const { resolve } = this.dataToPromiseMap[data];
        delete this.dataToPromiseMap[data];
        resolve();
      }
      return returnValue;
    });
  }

  // Use promises to ensure that we can know that the TSH backend has consumed
  // the input we're expecting.
  send(data) {
    return new Promise((resolve, reject) => {
      this.dataToPromiseMap[data] = { resolve, reject };
      this.push(data);
    });
  }

  init() {
    return this
      .sendWelcomeText()
      .then(() => this.sendEchoResponse());
  }

  sendEchoResponse() {
    return this.send(`
OK

    `);
  }

  sendWelcomeText() {
    return this.send(`
Welcome to somehost
Cisco Codec Release ce 8.1.0 PreAlpha0 afda72b 2015-12-13
SW Release Date: 2015-12-13 23:22:33, matchbox
*r Login successful

OK

    `);
  }
}
