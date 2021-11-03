export const UNKNOWN_ERROR = 0;
export const COMMAND_ERROR = 1;
export const ILLEGAL_VALUE = 2;
export const INVALID_PATH = 3;
export const PARAMETER_ERROR = 4;
export const INVALID_RESPONSE = 5;
export const INVALID_STATUS = 6;
export const METHOD_NOT_FOUND = -32601;

export class XAPIError extends Error {
  public data?: any;

  constructor(readonly code: number, reason: string, data?: any) {
    super(reason);
    Object.setPrototypeOf(this, XAPIError.prototype);
    if (data !== undefined) {
      this.data = data;
    }

    if (typeof reason !== 'string') {
      throw new Error('Reason for XAPIError must be a string');
    }

    if (typeof code !== 'number') {
      throw new Error('Error code for XAPIError must be a number');
    }
  }
}

export class IllegalValueError extends XAPIError {
  constructor(reason: string) {
    super(ILLEGAL_VALUE, reason);
    Object.setPrototypeOf(this, IllegalValueError.prototype);
  }
}

export class InvalidPathError extends XAPIError {
  constructor(reason: string, xpath: string) {
    super(INVALID_PATH, reason, { xpath });
    Object.setPrototypeOf(this, InvalidPathError.prototype);
  }
}

export class ParameterError extends XAPIError {
  constructor() {
    super(PARAMETER_ERROR, 'Invalid or missing parameters');
    Object.setPrototypeOf(this, ParameterError.prototype);
  }
}
