const ACTIONS = ['get', 'set', 'on', 'once'];

export default function createProxy(thisArg, root, path = []) {
  const handlers = {
    apply(target, _, args) {
      return root.call(thisArg, path.join('/'), ...args);
    },

    get(target, property) {
      if (ACTIONS.includes(property)) {
        return (...args) => root[property](path.join('/'), ...args);
      }

      return createProxy(thisArg, root, path.concat(property));
    },
  };

  return new Proxy(root, handlers);
}
