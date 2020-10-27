export function filter(schema: object, access: string[]) {
  const result: any = {};

  for (const [key, value] of Object.entries(schema)) {
    if (Array.isArray(value)) {
      result[key] = value.map((v) => filter(v, access));
    } else if (typeof value !== 'object') {
      result[key] = value;
    } else if (!value.hasOwnProperty('access')) {
      const subtree = filter(value, access);
      if (Object.keys(subtree).length) {
        result[key] = subtree;
      }
    } else if (access.includes(value.access)) {
      result[key] = value;
    }
  }

  return result;
}

export function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}

export function merge(a: object, b: object, path: string[] = []) {
  const result: any = { ...a };

  for (const [key, value] of Object.entries(b)) {
    const fullPath = path.concat(key);
    const pathStr = fullPath.join('.');

    if (!result.hasOwnProperty(key)) {
      result[key] = value;
    } else if (typeof value !== typeof result[key]) {
      throw new Error(`Mismatching types: ${pathStr}`);
    } else if (Array.isArray(value)) {
      if (!Array.isArray(result[key])) {
        throw new Error(`Unexpected array: ${pathStr}`);
      }
      if (typeof result[key][0] === 'object') {
        result[key][0] = merge(result[key][0], value[0], fullPath);
      } else {
        for (const entry of value) {
          if (!result[key].includes(entry)) {
            result[key].push(entry);
          }
        }
      }
    } else if (typeof value === 'object') {
      result[key] = merge(result[key], value, fullPath);
    } else if (result[key] !== value) {
      // tslint:disable-next-line no-console
      console.error(`Warning: Mismatch on value for ${pathStr}`);
    }
  }

  return result;
}
