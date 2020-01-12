import redent from 'redent';
import { generate, generateCommands  } from '../../src/schema';

describe('schemas', () => {
  describe('generate()', () => {


    it('imports XAPI from jsxapi', () => {
      expect(generate({})).toMatch('import XAPI from "jsxapi";');
    });

    it('can parameterize xapi import', () => {
      expect(generate({}, { xapiImport: '../src/xapi' })).toMatch(
        'import XAPI from "../src/xapi";',
      );
    });

    it('adds XAPI subtype', () => {
      expect(generate({})).toMatch('export class TypedXAPI extends XAPI');
    });

    it('exports TypedXAPI subclass', () => {
      expect(generate({})).toMatch('export default TypedXAPI;');
    });

    it('extends interface with Command, Config & Status trees', () => {
      const schema = generate({});
      expect(schema).toMatch('Command: CommandTree');
      expect(schema).toMatch('Config: ConfigTree');
      expect(schema).toMatch('Status: StatusTree');
    });


    describe('Config', () => {
      it('exports empty ConfigTree', () => {
        expect(generate({})).toMatch(redent(`
          export interface ConfigTree {
          }
        `).trim());
      });
    });

    describe('Status', () => {
      it('exports empty StatusTree', () => {
        expect(generate({})).toMatch(redent(`
          export interface StatusTree {
          }
        `).trim());
      });
    });
  });

  describe.skip('generateCommands()', () => {
    it('exports empty CommandTree', () => {
      expect(generateCommands(undefined)).toMatch(redent(`
        export interface CommandTree
        {}
      `).trim());
      expect(generateCommands({})).toMatch(redent(`
        export interface CommandTree
        {}
      `).trim());
    });

    it('adds command to CommandTree', () => {
      const schema = generateCommands({
        Audio: {
            Microphones: {
              Mute: {
                access: 'public-api',
                command: 'True',
                role: 'Admin;Integrator;User',
                description: 'Mute all microphones.',
              },
            },
          },
      });

      expect(schema).toMatch(redent(`
        export interface CommandTree
        {
          Audio: {
            Microphones: {
              Mute(): Promise<void>;
            },
          },
        }
      `).trim());
    });

    it.todo('respect roles');
    it.todo('adds doc string');
  });
});
