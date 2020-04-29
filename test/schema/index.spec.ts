import { parse } from '../../src/schema';
import {
  ArrayTree,
  Command,
  Generic,
  ImportStatement,
  List,
  Literal,
  Member,
  Plain,
  Root,
  Tree,
} from '../../src/schema/nodes';

describe('schemas', () => {
  describe('parse()', () => {
    it('imports XAPI from jsxapi', () => {
      expect(parse({})).toMatchObject({
        children: expect.arrayContaining([
          expect.objectContaining({
            children: expect.arrayContaining([
              new ImportStatement('jsxapi', ['XAPI', 'connectGen']),
            ]),
          }),
        ]),
      });
    });

    it('can parameterize xapi import', () => {
      const parsed = parse({}, { xapiImport: '../src/xapi' });
      expect(parsed).toMatchObject({
        children: expect.arrayContaining([
          expect.objectContaining({
            children: expect.arrayContaining([
              new ImportStatement('../src/xapi', ['XAPI', 'connectGen']),
            ]),
          }),
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
                  description: 'Display a message on screen.',
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

        const displayArgs = root.addInterface('CommandMessageAlertDisplayArgs');
        displayArgs.addChildren([
          new Member('Duration', new Plain('number'), { required: false }),
          new Member('Text', new Plain('string'), { required: true }),
          new Member('Level', new Literal('Info', 'Warning', 'Error'), { required: false }),
        ]);

        const audio: Tree = commandTree.addChild(new Tree('Message'));
        const mics = audio.addChild(new Tree('Alert'));
        mics.addChild(new Command('Display', displayArgs, undefined, {
          docstring: schema.Command.Message.Alert.Display.description,
        }));

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

        const resetArgs = root.addInterface('CommandSystemUnitFactoryResetArgs');
        resetArgs.addChild(
          new Member('Keep', new List(new Literal('LocalSetup', 'Network', 'Provisioning')), {
            required: false,
          }),
        );

        const systemUnit: Tree = commandTree.addChild(new Tree('SystemUnit'));
        systemUnit.addChild(new Command('FactoryReset', resetArgs, undefined));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it('parses multiline commands', () => {
        const schema = {
          Command: {
            HttpClient: {
              Post: {
                access: 'public-api',
                command: 'True',
                multiline: 'True',
                role: 'Admin',
                Url: {
                  required: 'True',
                  ValueSpace: {
                    type: 'String',
                    minLength: '8',
                    maxLength: '2048',
                  },
                },
              },
            },
          },
        };

        const postArgs = root.addInterface('CommandHttpClientPostArgs');
        postArgs.addChild(
          new Member('Url', 'string', { required: true }),
        );

        const httpClient: Tree = commandTree.addChild(new Tree('HttpClient'));
        httpClient.addChild(new Command('Post', postArgs, undefined, {
          multiline: true,
        }));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, commandTree]),
        });
      });

      it.todo('non-required parameters');
      it.todo('LiteralArray valuespace');
    });

    describe('Config', () => {
      let root: Root;
      let main: any;
      let configTree: any;

      beforeEach(() => {
        root = new Root();
        main = root.addMain();
        configTree = root.addInterface('ConfigTree');
        main.addChild(new Member('Config', new Generic('Configify', configTree)));
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
          },
        };

        const audio = configTree.addChild(new Tree('Audio'));
        audio.addChild(new Member('DefaultVolume', 'number'));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, configTree]),
        });
      });

      it('can fetch arrays', () => {
        const schema = {
          Configuration: {
            Audio: {
              Input: {
                HDMI: [{
                  id: '2',
                  Mode: {
                    access: 'public-api',
                    role: 'Admin;Integrator',
                    read: 'Admin;Integrator;User',
                    ValueSpace: {
                      type: 'Literal',
                      default: 'On',
                      Value: [
                        'Off',
                        'On'
                      ],
                    },
                  },
                }, {
                  id:'3',
                  Mode: {
                    access: 'public-api',
                    role: 'Admin;Integrator',
                    read: 'Admin;Integrator;User',
                    ValueSpace: {
                      type: 'Literal',
                      default: 'On',
                      Value: [
                        'Off',
                        'On'
                      ],
                    },
                  },
                }],
              },
            },
          },
        };

        configTree
          .addChild(new Tree('Audio'))
          .addChild(new Tree('Input'))
          .addChild(new Tree('HDMI'))
          .addChildren(['2', '3'].map((n) => {
            const tree = new Tree(n);
            tree.addChild(new Member('Mode', new Literal('Off', 'On')));
            return tree;
          }));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, configTree]),
        });
      });
    });

    describe('Event', () => {
      let root: Root;
      let main: any;
      let eventTree: any;

      beforeEach(() => {
        root = new Root();
        main = root.addMain();
        eventTree = root.addInterface('EventTree');
        main.addChild(new Member('Event', new Generic('Eventify', eventTree)));
      });

      it('adds Event tree', () => {
        const parsed = parse({
          Event: {},
        });

        expect(parsed).toMatchObject({
          children: expect.arrayContaining([main, eventTree]),
        });
      });

      it('adds sub-commands', () => {
        const schema = {
          Event: {
            Macros: {
              Macro: {
                Saved: {
                  Name: { 'type': 'string' },
                  access: 'public-api',
                  event: 'True',
                  read: 'Admin;User;Integrator;RoomControl'
                },
              },
              Runtime: {
                Ready: {
                  access: 'public-api',
                  event: 'True',
                  read: 'Admin;User;Integrator;RoomControl',
                },
              }
            },
            Peripherals: {
              DeviceDiscovery: {
                Device: [
                  {
                    DeviceType: { type: 'literal' },
                    MacAddress: {type: 'string' },
                    Name: { type: 'string' },
                  },
                ],
                access: 'public-api',
                event: 'True',
                read: 'Admin;User',
              },
            }
          },
        };

        const macros = eventTree
          .addChild(new Tree('Macros'));

        macros
          .addChild(new Tree('Macro'))
          .addChild(new Tree('Saved'))
          .addChild(new Member('Name', 'string'));

        macros
          .addChild(new Tree('Runtime'))
          .addChild(new Tree('Ready'));

        const device = eventTree
          .addChild(new Tree('Peripherals'))
          .addChild(new Tree('DeviceDiscovery'))
          .addChild(new ArrayTree('Device'));

        device.addChild(new Member('DeviceType', 'string'));
        device.addChild(new Member('MacAddress', 'string'));
        device.addChild(new Member('Name', 'string'));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, eventTree]),
        });
      });
    });

    describe('Status', () => {
      let root: Root;
      let main: any;
      let statusTree: any;

      beforeEach(() => {
        root = new Root();
        main = root.addMain();
        statusTree = root.addInterface('StatusTree');
        main.addChild(new Member('Status', new Generic('Statusify', statusTree)));
      });

      it('adds Status tree', () => {
        const parsed = parse({
          StatusSchema: {},
        });

        expect(parsed).toMatchObject({
          children: expect.arrayContaining([main, statusTree]),
        });
      });

      it('adds status nodes', () => {
        const schema = {
          StatusSchema: {
            Audio: {
              Volume: {
                ValueSpace: {
                  type: 'Integer',
                },
              },
            },
          }
        };

        const audio = statusTree.addChild(new Tree('Audio'));
        audio.addChild(new Member('Volume', 'number'));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, statusTree]),
        });
      });

      it('can fetch arrays', () => {
        const schema = {
          StatusSchema: {
            Audio: {
              Input: {
                Connectors: {
                  HDMI: [{
                    Mute: {
                      access: 'public-api',
                      read: 'Admin;User',
                      ValueSpace: {
                        type: 'Literal',
                        Value: [
                          'On',
                          'Off'
                        ],
                      },
                    },
                  }],
                },
              },
            },
          },
        };

        statusTree
          .addChild(new Tree('Audio'))
          .addChild(new Tree('Input'))
          .addChild(new Tree('Connectors'))
          .addChild(new ArrayTree('HDMI'))
          .addChild(new Member('Mute', new Literal('On', 'Off')));

        expect(parse(schema)).toMatchObject({
          children: expect.arrayContaining([main, statusTree]),
        });
      });
    });
  });
});
