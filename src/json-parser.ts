import { Transform } from 'stream';

/// <reference path="./jsonparse.d.ts" />
import Parser from 'jsonparse';

/**
 * Streaming JSON parser. Implements the Node.js {@link Duplex} stream API.
 */
export class JSONParser extends Transform {
  private enc = 'utf8'; // Default encoding
  private parser: Parser = new Parser();

  constructor() {
    super({ objectMode: true });
    this.reset();
  }

  public _flush(callback: () => void) {
    if (this.parser.stack.length) {
      this.onError(new Error('Unexpected end of input'));
    }
    callback();
  }

  private reset() {
    this.parser = new Parser();
    this.parser.onError = this.onError.bind(this);
    this.parser.onValue = this.onValue.bind(this);
  }

  private onError(e: any) {
    this.emit('error', e);
    this.reset();
  }

  private onValue(value: any) {
    if (!this.parser.stack.length) {
      this.push(value);
    }
  }

  // tslint:disable-next-line
  public _transform(chunk: any, _encoding: any, callback: () => void) {
    const data: string = chunk.toString(this.enc);
    data.split(/\n/).forEach((line) => {
      try {
        this.parser.write(line);
      } catch (error) {
        this.onError(error);
      }
    });
    callback();
  }
}

/**
 * Synchronous frontend to {@link JSONparser}.
 *
 * @param json JSON string input.
 * @return Parsed JSON object.
 */
export function parseJSON(json: string) {
  let obj;
  const parser = new JSONParser();

  parser.on('data', (next) => {
    obj = next;
  });
  parser.end(json);

  return obj;
}
