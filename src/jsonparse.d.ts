declare module 'jsonparse' {
  class Parser {
    onError: any;
    onValue: any;
    stack: { length: number };
    write(line: string): void;
  }
  export default Parser;
}
