import redent from 'redent';

import {
  Root,
  ImportStatement,
  MainClass,
  Interface,
  Command,
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
    it('can add property', () => {
      const iface = new Interface('CommandTree');
      iface.addChild(new Command('Dial'));
      expect(iface.serialize()).toMatch(redent(`
        export interface CommandTree {
          Dial(): Promise<void>;
        }
      `).trim());
    });
  });

  describe('Tree', () => {})
});
