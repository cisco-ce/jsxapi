import { Duplex } from 'stream';

import TSHBackend from '../src/backend/tsh';
import { XapiResult } from '../src/xapi/types';

interface Requests {
  [idx: string]: {
    resolve(result: any): void;
    reject(result: any): void;
  };
}

export default class MockTransport extends Duplex {
  public writeBuffer: string[];
  private dataToPromiseMap: Requests;

  constructor() {
    super();
    this.dataToPromiseMap = {};
    this.writeBuffer = [];
  }

  public _read() {
    //
  }

  public _write: Duplex['_write'] = (data, _encoding, done) => {
    this.writeBuffer.unshift(data.toString('utf8').trim());
    done();
  }

  // Intercept input passed to the backend so that we know which input has been
  // consumed. Map this to the promises from .send() and resolve them.
  public stubBackend(backend: TSHBackend) {
    const origMethod = backend.onTransportData;
    jest.spyOn(backend, 'onTransportData').mockImplementation((data) => {
      const returnValue = origMethod.call(backend, data);
      if ({}.hasOwnProperty.call(this.dataToPromiseMap, data)) {
        const { resolve } = this.dataToPromiseMap[data];
        delete this.dataToPromiseMap[data];
        resolve(null as unknown as XapiResult);
      }
      return returnValue;
    });
  }

  // Use promises to ensure that we can know that the TSH backend has consumed
  // the input we're expecting.
  public send(data: string) {
    return new Promise((resolve, reject) => {
      this.dataToPromiseMap[data] = { resolve, reject };
      this.push(data);
    });
  }

  public init() {
    return this.sendWelcomeText().then(() => this.sendEchoResponse());
  }

  private sendEchoResponse() {
    return this.send(`
OK

    `);
  }

  public sendWelcomeText() {
    return this.send(`
Welcome to somehost
Cisco Codec Release ce 8.1.0 PreAlpha0 afda72b 2015-12-13
SW Release Date: 2015-12-13 23:22:33, matchbox
*r Login successful

OK

    `);
  }

  public close() {
    //
  }
}
