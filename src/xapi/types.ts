import { Duplex } from 'stream';

export interface CloseableStream extends Duplex {
  close(): void;
}

export type Canceler = () => void;
export type Handler = () => void;
export type Path = string | string[];
export type NormalizedPath = Array<string | number>;
export type Listener<T = any> = (ev: T, root: any) => void;

export interface XapiOptions {
  feedbackInterceptor?: (data?: any) => void;
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
  Id: number;
}

export interface XapiError {
  message: string;
}
