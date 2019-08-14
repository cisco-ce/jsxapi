declare module 'jsonparse' {
  class Parser {
    public onError: any;
    public onValue: any;
    public stack: { length: number };
    public write(line: string): void;
  }
  export default Parser;
}
