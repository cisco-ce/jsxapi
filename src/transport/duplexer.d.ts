declare type Stream = import('stream').Stream;
declare type Duplex = import('stream').Duplex;

declare module 'duplexer' {
  function duplex(stdin: Stream, stdout: Stream): Duplex;
  export default duplex;
}
