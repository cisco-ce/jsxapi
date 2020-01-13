import redent from 'redent';

import {
  Root,
  ImportStatement,
  MainClass,
  Interface,
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
      root.addChild(new Interface('DialArgs'));
      expect(root.serialize()).toMatch('export interface DialArgs {}');
    });

    it('can build entire module', () => {
      // .ts module
      const root = new Root();

      // import ... from ...
      root.addChild(new ImportStatement());

      // Main XAPI class
      const main = root.addChild(new MainClass());

      const commandTree = root.addChild(new Interface('CommandTree'));
      main.addChild(new Member('Command', commandTree));

      const configTree = root.addChild(new Interface('ConfigTree'));
      main.addChild(new Member('Config', configTree));

      const statusTree = root.addChild(new Interface('StatusTree'));
      main.addChild(new Member('Status', statusTree));

      // XAPI command APIs
      const audio = commandTree.addChild(new Tree('Audio'));
      audio.addChild(new Tree('Microphones')).addChild(new Command('Mute'));
      const audioPlayArgs = root.addChild(new Interface('AudioPlayArgs'));
      const soundLiteral = new Literal('Alert', 'Busy', 'CallInitiate');
      const onOffLiteral = new Literal('On', 'Off');
      audioPlayArgs.addChildren([
        new Member('Sound', soundLiteral),
        new Member('Loop', onOffLiteral, { required: false }),
      ]);
      audio
        .addChild(new Tree('Sound'))
        .addChild(new Command('Play', audioPlayArgs));
      const dialArgs = root.addChild(new Interface('DialArgs'));
      dialArgs.addChild(new Member('Number', new Plain('string')));
      commandTree.addChild(new Command('Dial', dialArgs));

      // XAPI config APIs
      configTree
        .addChild(new Tree('SystemUnit'))
        .addChild(new Config('Name', new Plain('string')));

      // XAPI status APIs
      statusTree
        .addChild(new Tree('Audio'))
        .addChild(new Status('Volume', new Plain('number')));

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
      const main = new MainClass();
      expect(main.serialize()).toMatch(
        'export class TypedXAPI extends XAPI {}',
      );
    });

    it('supports passing custom names', () => {
      const main = new MainClass('XapiWithTypes', 'JSXAPI');
      expect(main.serialize()).toMatch(
        'export class XapiWithTypes extends JSXAPI {}',
      );
    });

    it('exports as default', () => {
      const main = new MainClass();
      expect(main.serialize()).toMatch('export default TypedXAPI');
    });

    it('exports an interface with name', () => {
      const main = new MainClass();
      expect(main.serialize()).toMatch('export interface TypedXAPI {}');
    });
  });

  describe('Interface', () => {
    it('can add command (function)', () => {
      const iface = new Interface('CommandTree');
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
      const iface = new Interface('CommandTree');
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

  describe('Tree', () => {});

  describe('Command', () => {
    it('serializes empty args and response', () => {
      const command = new Command('Mute');
      expect(command.serialize()).toMatch('Mute(): Promise<any>');
    });

    it('supports parameter list', () => {
      const dialArgs = new Interface('DialArgs');
      const command = new Command('Dial', dialArgs);
      expect(command.serialize()).toMatch('Dial(args: DialArgs): Promise<any>');
    });

    it('supports return type', () => {
      const callHistoryArgs = new Interface('CallHistoryGetArgs');
      const callHistoryResponse = new Interface('CallHistoryGetResult');
      const command = new Command('Get', callHistoryArgs, callHistoryResponse);
      expect(command.serialize()).toMatch(
        'Get(args: CallHistoryGetArgs): Promise<CallHistoryGetResult>',
      );
    });
  });
});
