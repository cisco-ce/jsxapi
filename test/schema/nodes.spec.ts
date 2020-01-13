import redent from 'redent';

import {
  Root,
  ImportStatement,
  Command,
  Tree,
  Member,
  Config,
  Plain,
  Status,
  Literal,
} from '../../src/schema/nodes';

describe('schema nodes', () => {
  describe('Root', () => {
    it('empty document serializes to empty string', () => {
      const root = new Root();
      expect(root.serialize()).toEqual('');
    });

    it('allows creating new interfaces', () => {
      const root = new Root();
      root.addInterface('DialArgs');
      expect(root.serialize()).toMatch('export interface DialArgs {}');
    });

    it('can build entire module', () => {
      // .ts module
      const root = new Root();

      // import ... from ...
      root.addChild(new ImportStatement());

      // Main XAPI class
      const main = root.addMain();

      const commandTree = root.addInterface('CommandTree');
      main.addChild(new Member('Command', commandTree));

      const configTree = root.addInterface('ConfigTree');
      main.addChild(new Member('Config', configTree));

      const statusTree = root.addInterface('StatusTree');
      main.addChild(new Member('Status', statusTree));

      // XAPI command APIs
      const audio = commandTree.addChild(new Tree('Audio'));
      audio.addChild(new Tree('Microphones')).addChild(new Command('Mute'));
      const audioPlayArgs = root.addInterface('AudioPlayArgs');
      const soundLiteral = new Literal('Alert', 'Busy', 'CallInitiate');
      const onOffLiteral = new Literal('On', 'Off');
      audioPlayArgs.addChildren([
        new Member('Sound', soundLiteral),
        new Member('Loop', onOffLiteral, { required: false }),
      ]);
      audio
        .addChild(new Tree('Sound'))
        .addChild(new Command('Play', audioPlayArgs));
      const dialArgs = root.addInterface('DialArgs');
      dialArgs.addChild(new Member('Number', 'string'));
      commandTree.addChild(new Command('Dial', dialArgs));

      // XAPI config APIs
      configTree
        .addChild(new Tree('SystemUnit'))
        .addChild(new Config('Name', 'string'));

      // XAPI status APIs
      statusTree
        .addChild(new Tree('Audio'))
        .addChild(new Status('Volume', 'number'));

      // It dumps the shit
      expect(root.serialize()).toMatchSnapshot();
    });
  });

  describe('ImportStatement', () => {
    it('serializes import child', () => {
      const node = new ImportStatement();
      expect(node.serialize()).toMatch('import XAPI from "jsxapi";');
    });

    it('can customize import name and module', () => {
      const node = new ImportStatement('XapiBase', '../../xapi');
      expect(node.serialize()).toMatch('import XapiBase from "../../xapi";');
    });
  });

  describe('MainClass', () => {
    it('extends base class', () => {
      const main = new Root().addMain();
      expect(main.serialize()).toMatch(
        'export class TypedXAPI extends XAPI {}',
      );
    });

    it('supports passing custom names', () => {
      const main = new Root().addMain('XapiWithTypes', 'JSXAPI');
      expect(main.serialize()).toMatch(
        'export class XapiWithTypes extends JSXAPI {}',
      );
    });

    it('exports as default', () => {
      const main = new Root().addMain();
      expect(main.serialize()).toMatch('export default TypedXAPI');
    });

    it('exports an interface with name', () => {
      const main = new Root().addMain();
      expect(main.serialize()).toMatch('export interface TypedXAPI {}');
    });
  });

  describe('Interface', () => {
    it('can add command (function)', () => {
      const iface = new Root().addInterface('CommandTree');
      iface.addChild(new Command('Dial'));
      expect(iface.serialize()).toMatch(
        redent(`
        export interface CommandTree {
          Dial(): Promise<any>;
        }
      `).trim(),
      );
    });

    it('can add tree', () => {
      const iface = new Root().addInterface('CommandTree');
      iface
        .addChild(new Tree('Audio'))
        .addChild(new Tree('Microphones'))
        .addChild(new Command('Mute'));
      expect(iface.serialize()).toMatch(
        redent(`
        export interface CommandTree {
          Audio: {
            Microphones: {
              Mute(): Promise<any>,
            },
          };
        }
      `).trim(),
      );
    });
  });

  describe('Tree', () => {
    it('renders levels of nesting', () => {
      const audio = new Tree('Audio');
      expect(audio.serialize()).toMatchSnapshot();

      const mic = audio.addChild(new Tree('Microphones'));
      expect(audio.serialize()).toMatchSnapshot();

      mic.addChild(new Member('LedIndicator', new Literal('On', 'Off')));
      expect(audio.serialize()).toMatchSnapshot();
    });
  });

  describe('Command', () => {
    it('serializes empty args and response', () => {
      const command = new Command('Mute');
      expect(command.serialize()).toMatch('Mute(): Promise<any>');
    });

    it('supports parameter list', () => {
      const dialArgs = new Root().addInterface('DialArgs');
      const command = new Command('Dial', dialArgs);
      expect(command.serialize()).toMatch('Dial(args: DialArgs): Promise<any>');
    });

    it('supports return type', () => {
      const callHistoryArgs = new Root().addInterface('CallHistoryGetArgs');
      const callHistoryResponse = new Root().addInterface('CallHistoryGetResult');
      const command = new Command('Get', callHistoryArgs, callHistoryResponse);
      expect(command.serialize()).toMatch(
        'Get(args: CallHistoryGetArgs): Promise<CallHistoryGetResult>',
      );
    });
  });

  describe('Config', () => {
    it('adds get()', () => {
      const output = new Config('Name', 'string').serialize();
      expect(output).toMatch('Name: {');
      expect(output).toMatch('get(): Promise<string>');
    });

    it('adds set()', () => {
      const output = new Config('Name', 'string').serialize();
      expect(output).toMatch('Name: {');
      expect(output).toMatch('set(args: string): Promise<any>');
    });
  });

  describe('Status', () => {
    it('adds get()', () => {
      const output = new Status('Volume', 'number').serialize();
      expect(output).toMatch('Volume: {');
      expect(output).toMatch('get(): Promise<number>');
    });

    it('doest not add set()', () => {
      const output = new Status('Volume', 'number').serialize();
      expect(output).toMatch('Volume: {');
      expect(output).not.toMatch('set');
    });
  });
});
