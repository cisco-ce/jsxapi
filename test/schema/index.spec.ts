import redent from 'redent';
import { generate, parse } from '../../src/schema';
import {
  Root,
  ImportStatement,
  Member,
  Tree,
  Command,
  Plain,
  Literal,
  Config,
  List,
} from '../../src/schema/nodes';

describe('schemas', () => {
  describe('parse()', () => {
    it('imports XAPI from jsxapi', () => {
      expect(parse({})).toMatchObject({
        children: expect.arrayContaining([new ImportStatement()]),
      });
    });

    it('can parameterize xapi import', () => {
      const parsed = parse({}, { xapiImport: '../src/xapi' });
      expect(parsed).toMatchObject({
        children: expect.arrayContaining([
          new ImportStatement('../src/xapi'),
        ]),
      });
    });

    it('adds XAPI subtype', () => {
      expect(parse({})).toMatchObject({
        children: expect.arrayContaining([new Root().addMain()]),
      });
    });

    it('fails with incorrect Command type', () => {
      const schema = { Command: 'foobar' };
      expect(() => parse(schema)).toThrow();
    });

    it.todo('adds Config tree');
    it.todo('adds Status tree');

    describe('Commands', () => {
      let root: Root;
      let main: any;
      let commandTree: any;

      beforeEach(() => {
        root = new Root();
        main = root.addMain();
        commandTree = root.addInterface('CommandTree');
        main.addChild(new Member('Command', commandTree));
      });

      it('adds Command tree', () => {
        const parsed = parse({
          Command: {},
        });

        expect(parsed).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it('ignores lower-case attributes', () => {
        const parsed = parse({
          Command: {
            product: 'Cisco Codec',
            version: 'ce9.12.0.9a9b746472a (TEST SW, ce-9.12.dev-2685-g9a9b746472a)',
            apiVersion: '4',
          },
        });

        expect(parsed).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it('adds sub-commands', () => {
        const schema = {
          Command: {
            Message: {
              Alert: {
                Display: {
                  command: 'True',
                  Duration: {
                    required: 'False',
                    ValueSpace: {
                      type: 'Integer',
                      min: '0',
                      max: '3600',
                    },
                  },
                  Text: {
                    required: 'True',
                    ValueSpace: {
                      type: 'String',
                      minLength: '0',
                      maxLength: '255',
                    },
                  },
                  Level: {
                    required: 'False',
                    ValueSpace: {
                      type: 'Literal',
                      Value: ['Info', 'Warning', 'Error'],
                    },
                  },
                },
              },
            },
          },
        };

        const displayArgs = root.addInterface('MessageAlertDisplayArgs');
        displayArgs.addChildren([
          new Member('Duration', new Plain('number'), { required: false }),
          new Member('Text', new Plain('string'), { required: true }),
          new Member('Level', new Literal('Info', 'Warning', 'Error'), { required: false }),
        ]);

        const audio: Tree = commandTree.addChild(new Tree('Message'));
        const mics = audio.addChild(new Tree('Alert'));
        mics.addChild(new Command('Display', displayArgs));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it('parses LiteralArray', () => {
        const schema = {
          Command: {
            SystemUnit: {
              FactoryReset: {
                access: 'public-api',
                command: 'True',
                role: 'Admin;User',
                Keep: [{
                  required:'False',
                  ValueSpace:{
                    type: 'LiteralArray',
                    Value: [
                      'LocalSetup',
                      'Network',
                      'Provisioning',
                    ],
                  },
                }],
              },
            },
          },
        };

        const resetArgs = root.addInterface('SystemUnitFactoryResetArgs');
        resetArgs.addChild(
          new Member('Keep', new List(new Literal('LocalSetup', 'Network', 'Provisioning')), {
            required: false,
          }),
        );

        const systemUnit: Tree = commandTree.addChild(new Tree('SystemUnit'));
        systemUnit.addChild(new Command('FactoryReset', resetArgs));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it.todo('non-required parameters');
      it.todo('LiteralArray valuespace');
      it.todo('multiline commands');
    });

    describe('Config', () => {
      let root: Root;
      let main: any;
      let configTree: any;

      beforeEach(() => {
        root = new Root();
        main = root.addMain();
        configTree = root.addInterface('ConfigTree');
        main.addChild(new Member('Config', configTree));
      });

      it('adds Config tree', () => {
        const parsed = parse({
          Configuration: {},
        });

        expect(parsed).toMatchObject({
          children: expect.arrayContaining([main, configTree]),
        });
      });

      it('adds config nodes', () => {
        const schema = {
          Configuration: {
            Audio: {
              DefaultVolume: {
                ValueSpace: {
                  type: 'Integer',
                  default: '50',
                  min: '0',
                  max: '100',
                },
              },
            },
          }
        };

        const audio = configTree.addChild(new Tree('Audio'));
        audio.addChild(new Config('DefaultVolume', 'number'));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, configTree]),
        });
      });
    });

    xdescribe('Status', () => {
      it('exports empty StatusTree', () => {
        expect(generate({})).toMatch(
          redent(`
          export interface StatusTree {
          }
        `).trim(),
        );
      });
    });
  });

  // describe.skip('generateCommands()', () => {
  //   it('exports empty CommandTree', () => {
  //     expect(generateCommands(undefined)).toMatch(redent(`
  //       export interface CommandTree
  //       {}
  //     `).trim());
  //     expect(generateCommands({})).toMatch(redent(`
  //       export interface CommandTree
  //       {}
  //     `).trim());
  //   });

  //   it('adds command to CommandTree', () => {
  //     const schema = generateCommands({
  //       Audio: {
  //           Microphones: {
  //             Mute: {
  //               access: 'public-api',
  //               command: 'True',
  //               role: 'Admin;Integrator;User',
  //               description: 'Mute all microphones.',
  //             },
  //           },
  //         },
  //     });

  //     expect(schema).toMatch(redent(`
  //       export interface CommandTree
  //       {
  //         Audio: {
  //           Microphones: {
  //             Mute(): Promise<void>;
  //           },
  //         },
  //       }
  //     `).trim());
  //   });

  //   it.todo('respect roles');
  //   it.todo('adds doc string');
  // });
});
