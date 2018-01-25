import { Transform } from 'stream';

import Parser from 'jsonparse';


/**
 * @external {Transform} https://nodejs.org/api/stream.html#stream_class_stream_transform
 */


/**
 * Streaming JSON parser. Implements the Node.js {@link Duplex} stream API.
 */
export class JSONParser extends Transform {
  constructor() {
    super({ objectMode: true });
    this.enc = 'utf8';  // Default encoding
    this.reset();
  }

  reset() {
    this.parser = new Parser();
    this.parser.onError = this.onError.bind(this);
    this.parser.onValue = this.onValue.bind(this);
  }

  onError(e) {
    this.emit('error', e);
    this.reset();
  }

  onValue(value) {
    if (!this.parser.stack.length) {
      this.push(value);
    }
  }

  _flush(callback) {
    if (this.parser.stack.length) {
      this.onError(new Error('Unexpected end of input'));
    }
    callback();
  }

  _transform(chunk, encoding, callback) {
    const data = chunk.toString(this.enc);
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
export function parseJSON(json) {
  let obj;
  const parser = new JSONParser();

  parser.on('data', (_obj) => { obj = _obj; });
  parser.end(json);

  return obj;
}
