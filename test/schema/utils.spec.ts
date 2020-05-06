import { filter, merge } from '../../src/schema/utils';

describe('schemas', () => {
  describe('filter()', () => {
    it('filters arrays', () => {
      const a = {
        node: [
          {
            foo: { bar: 'baz', access: 'public' },
            bar: { baz: 'quux', access: 'private' },
          },
        ],
      };

      expect(filter(a, ['public'])).toEqual({
        node: [{
          foo: { bar: 'baz', access: 'public' },
        }],
      });
    });

    it('filters objects', () => {
      const a = {
        foo: { bar: 'baz', access: 'public' },
        bar: { baz: 'quux', access: 'private' },
      };

      expect(filter(a, ['public'])).toEqual({
        foo: { bar: 'baz', access: 'public' },
      });
    });
  });

  describe('merge()', () => {
    it('left identity', () => {
      const a = {
        foo: {
          bar: 'baz',
        },
      };
      expect(merge(a, {})).toEqual(a);
    });

    it('right identity', () => {
      const a = {
        foo: {
          bar: 'baz',
        },
      };
      expect(merge({}, a)).toEqual(a);
    });

    it('merges two schemas', () => {
      const a = {
        foo: { bar: 10 },
      };

      const b = {
        foo: { baz: 20 },
      };

      expect(merge(a, b)).toEqual({
        foo: {
          bar: 10,
          baz: 20,
        },
      });
    });

    it('dies on mismatching nested types', () => {
      const a = {
        foo: 'bar',
      };

      const b = {
        foo: 42,
      };

      expect(() => merge(a, b)).toThrow(/mismatching types/i);
    });

    it('merges arrays of scalars', () => {
      const a = {
        foo: ['bar', 'baz'],
      };

      const b = {
        foo: ['bar', 'quux' ],
      };

      expect(merge(a, b)).toEqual({
        foo: ['bar', 'baz', 'quux'],
      });
    });

    it('merges nested objects in arrays', () => {
      const a = {
        foo: [{
          bar: ['foo', 'bar'],
          baz: 10,
        }],
      };

      const b = {
        foo: [{
          bar: ['baz'],
          quux: 42,
        }],
      };

      expect(merge(a, b)).toEqual({
        foo: [{
          bar: ['foo', 'bar', 'baz'],
          baz: 10,
          quux: 42,
        }],
      });
    });
  });
});
