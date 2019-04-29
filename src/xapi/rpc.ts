import {
  IllegalValueError,
  INVALID_RESPONSE,
  INVALID_STATUS,
  InvalidPathError,
  ParameterError,
  UNKNOWN_ERROR,
  XAPIError,
} from './exc';
import { XapiRequest } from './types';

const scalars = ['number', 'string'];
const isScalar = (value: any) => scalars.indexOf(typeof value) >= 0;

const VERSION = '2.0';

/*
 * Collapse "Value" into parent + skip lowercase props
 */
export function collapse(data: any): any {
  if (Array.isArray(data)) {
    return data.map(collapse);
  } else if (isScalar(data)) {
    return data;
  } else if ({}.hasOwnProperty.call(data, 'Value') && isScalar(data.Value)) {
    return data.Value;
  }

  const result: { [idx: string]: any } = {};

  Object.keys(data).forEach((key) => {
    result[key] = collapse(data[key]);
  });

  return result;
}

export function createRequest(id: string | null, method: string, params: any) {
  const request: XapiRequest = { jsonrpc: VERSION, method };

  if (id) {
    request.id = id;
  }

  if (params) {
    request.params = {};

    Object.keys(params).forEach((key) => {
      const value = params[key];

      if (
        key !== 'body' &&
        typeof value === 'string' &&
        value.indexOf('\n') !== -1
      ) {
        throw new Error('Parameters may not contain newline characters');
      }

      request.params[key] = params[key];
    });
  }

  return request;
}

export function createResponse(id: string, result: any) {
  return { jsonrpc: VERSION, id, result };
}

export function createErrorResponse(id: string, error: any) {
  let payload: { [idx: string]: any };

  if (error instanceof XAPIError) {
    payload = {
      code: error.code,
      message: error.message,
    };
  } else {
    payload = {
      code: UNKNOWN_ERROR,
      message: (error.message || error).toString(),
    };
  }

  if ({}.hasOwnProperty.call(error, 'data')) {
    payload.data = error.data;
  }

  return { jsonrpc: VERSION, id, error: payload };
}

export function parseFeedbackResponse(response: any) {
  return collapse(response);
}

function assertValidCommandResponse(response: any) {
  if (!{}.hasOwnProperty.call(response, 'CommandResponse')) {
    throw new XAPIError(
      INVALID_RESPONSE,
      'Invalid command response: Missing "CommandResponse" attribute',
    );
  }

  const keys = Object.keys(response.CommandResponse);
  if (keys.length !== 1) {
    throw new XAPIError(
      INVALID_RESPONSE,
      `Invalid command response: Wrong number of keys (${keys.length})`,
    );
  }

  const root = response.CommandResponse[keys[0]];

  switch (root.status) {
    case 'Error': {
      const body = collapse(root);
      const { Error, Reason, XPath } = body;
      const reason = Error || Reason || keys[0];

      if (XPath) {
        throw new InvalidPathError(reason, XPath);
      }

      throw new XAPIError(UNKNOWN_ERROR, reason, body);
    }
    case 'ParameterError':
      throw new ParameterError();
    case 'OK':
      return root;
    default:
      throw new XAPIError(
        INVALID_STATUS,
        `Invalid command status: ${root.status}`,
      );
  }
}

export function createCommandResponse(response: any) {
  const root = assertValidCommandResponse(response);
  const collapsed = collapse(root);
  return Object.keys(collapsed).length ? collapsed : null;
}

function digObj(path: Array<string | number>, obj: any) {
  const parts = path.slice();
  let value = obj;

  while (parts.length) {
    const part = parts.shift()!;
    if (Array.isArray(value)) {
      value = value.find((v) => parseInt(v.id, 10) === part);
    } else if (!{}.hasOwnProperty.call(value, part)) {
      return undefined;
    } else {
      value = value[part];
    }
  }

  return value;
}

export function createGetResponse(request: any, response: any) {
  if ({}.hasOwnProperty.call(response, 'CommandResponse')) {
    assertValidCommandResponse(response);
  }

  return digObj(request.params.Path, collapse(response));
}

export function createSetResponse(request: any, response: any) {
  if ({}.hasOwnProperty.call(response, 'CommandResponse')) {
    assertValidCommandResponse(response);
  }

  if (Object.keys(response).length > 1) {
    const leaf = digObj(request.params.Path, response);
    if (leaf.error === 'True') {
      throw new IllegalValueError(leaf.Value);
    }
  }
  return null;
}
