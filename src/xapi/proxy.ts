// Proxy types inspired by:
// https://www.typescriptlang.org/docs/handbook/advanced-types.html

const ACTIONS = ['get', 'set', 'on', 'once'];

export default function createProxy(thisArg: any, root: any, path: string[] = []): any {
  const handlers = {
    apply(target: any, _: any, args: any[]) {
      if (typeof root === 'function') {
        return root.call(thisArg, path.join('/'), ...args);
      }
      throw new TypeError(`Object is not callable: ${root}`);
    },

    get(target: any, property: string) {
      if (ACTIONS.includes(property)) {
        if (typeof root[property] !== 'function') {
          throw new TypeError(`Property is not callable: ${root}[${property}]`);
        }
        return (...args: any[]) => root[property](path.join('/'), ...args);
      }

      return createProxy(thisArg, root, path.concat(property));
    },
  };

  return new Proxy(root, handlers);
}
