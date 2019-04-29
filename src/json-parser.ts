import { Transform } from 'stream';

/// <reference path="./jsonparse.d.ts" />
import Parser from 'jsonparse';

/**
 * @external {Transform} https://nodejs.org/api/stream.html#stream_class_stream_transform
 */

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

  reset() {
    this.parser = new Parser();
    this.parser.onError = this.onError.bind(this);
    this.parser.onValue = this.onValue.bind(this);
  }

  onError(e: any) {
    this.emit('error', e);
    this.reset();
  }

  onValue(value: any) {
    if (!this.parser.stack.length) {
      this.push(value);
    }
  }

  _flush(callback: () => void) {
    if (this.parser.stack.length) {
      this.onError(new Error('Unexpected end of input'));
    }
    callback();
  }

  _transform(chunk: any, encoding: any, callback: () => void) {
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
 * @param {string} json - JSON string input.
 * @return {Object} - Parsed JSON object.
 */
export function parseJSON(json: string) {
  let obj;
  const parser = new JSONParser();

  parser.on('data', (_obj) => {
    obj = _obj;
  });
  parser.end(json);

  return obj;
}
