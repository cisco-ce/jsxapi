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
  List,
  Function,
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

    it('interface names must be unique', () => {
      const root = new Root();
      root.addInterface('DialArgs');
      expect(() => root.addInterface('DialArgs')).toThrow(
        /interface already exists/i,
      );
    });

    it('can only add a single Main class', () => {
      const root = new Root();
      root.addMain();
      expect(() => root.addMain()).toThrow(/main class already defined/i);
    });

    describe('getMain()', () => {
      it('throws with no main defined', () => {
        const root = new Root();
        expect(() => root.getMain()).toThrow(/no main class defined/i);
      });

      it('can get main class', () => {
        const root = new Root();
        const main = root.addMain();
        expect(root.getMain()).toEqual(main);
      });
    });

    describe('addGenericInterfaces', () => {
      it('adds generic interfaces', () => {
        const root = new Root();
        root.addGenericInterfaces();
        const serialized = root.serialize();
        expect(serialized).toMatch('export interface Gettable<T>');
        expect(serialized).toMatch('export interface Settable<T>');
        expect(serialized).toMatch('export interface Listenable<T>');
      });

      it('adds Config<T> interface', () => {
        const root = new Root();
        root.addGenericInterfaces();
        expect(root.serialize()).toMatch('export interface Config<T> extends Gettable<T>, Settable<T>, Listenable<T>');
      });

      it('adds Status<T> interface', () => {
        const root = new Root();
        root.addGenericInterfaces();
        expect(root.serialize()).toMatch('export interface Status<T> extends Gettable<T>, Listenable<T>');
      });
    });

    it('can build entire module', () => {
      // .ts module
      const root = new Root();

      // import ... from ...
      root.addChild(new ImportStatement());

      // Main XAPI class + generic interfaces
      const main = root.addMain();
      root.addGenericInterfaces();

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

      const resetArgs = root.addInterface('SystemUnitFactoryResetArgs');
      resetArgs.addChild(
        new Member(
          'Keep',
          new List(new Literal('LocalSetup', 'Network', 'Provisioning')),
          { required: false },
        ),
      );
      const reset = commandTree
        .addChild(new Tree('SystemUnit'))
        .addChild(new Command('FactoryReset', resetArgs));

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
      expect(node.serialize()).toMatch('import { XAPI, connectGen } from "jsxapi";');
    });

    it('can customize module', () => {
      const node = new ImportStatement('../../xapi');
      expect(node.serialize()).toMatch('import { XAPI, connectGen } from "../../xapi";');
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

    it('uses connectGen to export connect', () => {
      const main = new Root().addMain();
      expect(main.serialize()).toMatch('export const connect = connectGen(TypedXAPI);');
    })

    it('exports an interface with name', () => {
      const main = new Root().addMain();
      expect(main.serialize()).toMatch('export interface TypedXAPI {}');
    });
  });

  describe('Interface', () => {
    it('can extend', () => {
      const root = new Root();
      root.addInterface('Gettable');
      const iface = root.addInterface('Config', ['Gettable']);
      expect(iface.serialize()).toMatch('export interface Config extends Gettable {}');
    });

    it('extending from an interface requires it to exist', () => {
      const root = new Root();
      expect(() => root.addInterface('Config', ['Gettable'])).toThrow(
        /cannot add interface Config.*missing interfaces: Gettable/i,
      );
    });

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

  describe('List', () => {
    it('places literal in parentheses', () => {
      const literalArray = new List(new Literal('Foo', 'Bar', 'Baz'));
      expect(literalArray.getType()).toMatch("('Foo' | 'Bar' | 'Baz')[]");
    })
  });

  describe('Member', () => {
    it('quotes members with names containing special characters', () => {
      const option = new Member('Option.1', 'string');
      expect(option.serialize()).toMatch('"Option.1": string');
    });

    it('can add docstring', () => {
      const docstring = 'Define the default volume for the speakers.';
      const command = new Member('Microphones', 'number', { docstring });
      expect(command.serialize()).toMatch(docstring);
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
    it('can add docstring', () => {
      const command = new Command('Microphones', undefined, undefined, 'Mute all microphones.');
      expect(command.serialize()).toMatch('Mute all microphones.');
    });
  });

  describe('Config', () => {
    it('is a member with a generic Config<T>', () => {
      const config = new Config('Name', 'string');
      expect(config.serialize()).toMatch('Name: Config<string>');
    });
  });

  describe('Status', () => {
    it('is a member with a generic Status<T>', () => {
      const status = new Status('Volume', 'number');
      expect(status.serialize()).toMatch('Volume: Status<number>');
    });
  });
});
