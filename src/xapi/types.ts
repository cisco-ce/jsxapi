import { Duplex } from 'stream';

export interface CloseableStream extends Duplex {
  close(): void;
}

export type Handler = () => void;
export type Path = string | string[];
export type NormalizedPath = Array<string | number>;
export type Listener = (...args: any[]) => void;

export interface XapiOptions {
  feedbackInterceptor?: never;
}

export interface XapiRequest {
  id?: string;
  method: string;
  jsonrpc: string;
  params?: any;
}

export interface XapiResponse {
  id: string;
  method: string;
  params: any;
  result: XapiResult;
  error: XapiError;
}

export interface XapiResult {
  Id: string;
}

export type XapiError = unknown;

export interface Requests {
  [idx: string]: {
    resolve(result: XapiResult): void;
    reject(result: XapiError): void;
  };
}
