export const UNKNOWN_ERROR = 0;
export const COMMAND_ERROR = 1;
export const ILLEGAL_VALUE = 2;
export const INVALID_PATH = 3;
export const PARAMETER_ERROR = 4;
export const INVALID_RESPONSE = 5;
export const INVALID_STATUS = 6;
export const METHOD_NOT_FOUND = -32601;


export class XAPIError extends Error {
  constructor(code, reason, data) {
    if (typeof reason !== 'string') {
      throw new Error('Reason for XAPIError must be a string');
    }

    if (typeof code !== 'number') {
      throw new Error('Error code for XAPIError must be a number');
    }

    super(reason);
    this.code = code;
    if (data !== undefined) {
      this.data = data;
    }
  }
}


export class IllegalValueError extends XAPIError {
  constructor(reason) {
    super(ILLEGAL_VALUE, reason);
  }
}


export class InvalidPathError extends XAPIError {
  constructor(reason, xpath) {
    super(INVALID_PATH, reason);
    this.data = { xpath };
  }
}


export class ParameterError extends XAPIError {
  constructor() {
    super(PARAMETER_ERROR, 'Invalid or missing parameters');
  }
}
