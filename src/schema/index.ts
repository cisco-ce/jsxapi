import {
  Node,
  Root,
  ImportStatement,
  Tree,
  Member,
  Command,
  Plain,
  Literal,
  List,
} from './nodes';

export interface GenerateOpts {
  access?: 'public-api' | 'public-api-preview';
  role?: 'Admin' | 'User' | 'Integrator' | 'RoomControl';
  xapiImport?: string;
}

interface Leaf {
  command?: string;
  ValueSpace: ValueSpace;
}

interface ValueSpace {
  required: 'True' | 'False';
  type: 'Integer' | 'IntegerArray' | 'Literal' | 'LiteralArray' | 'String' | 'StringArray';
  Value?: string[];
}

function parseValueSpace(valuespace: ValueSpace, path: string[]) {
  switch (valuespace.type) {
    case 'Integer':
      return new Plain('number');
    case 'IntegerArray':
      return new Plain('number[]');
    case 'String':
      return new Plain('string');
    case 'StringArray':
      return new Plain('string[]');
    case 'Literal':
    case 'LiteralArray':
      if (!valuespace.Value) {
        throw new Error('Missing literal valuespace values');
      }
      if (!valuespace.Value.length) {
        throw new Error('Empty literal valuespace values');
      }
      const vs = new Literal(...valuespace.Value);
      return valuespace.type === 'LiteralArray' ? new List(vs) : vs;
    default:
      throw new Error(`Invalid ValueSpace type: ${valuespace.type}`);
  }
}

function isCommandLeaf(value: unknown): value is Leaf {
  return (value as Leaf).command === 'True';
}

function isAttr(key: string): boolean {
  return !!key.match(/^[a-z]/);
}

function parseParameters(command: Leaf, path: string[]): Member[] {
  const params: Member[] = [];

  for (const [param, props] of Object.entries(command)) {
    if (isAttr(param)) {
      // skip lowercase props
      continue;
    }
    const fullPath = path.concat(param);
    try {
      const ps = Array.isArray(props) ? props[0] : props;
      const valuespace = parseValueSpace(ps.ValueSpace, fullPath);
      const required = ps.required === 'True';
      params.push(new Member(param, valuespace, { required }));
    } catch (error) {
      console.error(`warning: '${fullPath.join('/')}' error parsing valuespace: ${error}`);
    }
  }

  return params;
}

function forEachEntries(
  schema: any,
  visitor: (key: string, value: any) => void,
) {
  Object.entries(schema)
    .filter(([key]) => !isAttr(key))
    .forEach(([key, value]) => visitor(key, value));
}

function parseCommandTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
    if (isCommandLeaf(value)) {
      const fullPath = path.concat(key);
      const params = parseParameters(value, fullPath);
      if (!params.length) {
        tree.addChild(new Command(key));
      } else {
        const paramsType = root.addInterface(`${fullPath.join('')}Args`);
        paramsType.addChildren(params);
        tree.addChild(new Command(key, paramsType));
      }
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseCommandTree(root, value, subTree, path.concat(key));
    }
  });
}

function parseConfigTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
  });
}

function parseStatusTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
  });
}

type SchemaParser = (root: Root, schema: any, tree: Tree, path: string[]) => void;

function parseSchema(
  type: 'Command' | 'Config' | 'Status',
  root: Root,
  schema: any,
  parser: SchemaParser,
) {
  const key = {
    Command: 'Command',
    Config: 'Configuration',
    Status: 'Status',
  }[type];
  const subSchema = schema[key];

  if (!subSchema) {
    return;
  }

  if (typeof subSchema !== 'object') {
    throw new Error(`schema.${type} is not an object`);
  }

  const tree = root.addInterface(`${type}Tree`);
  root.getMain().addChild(new Member(type, tree));

  parser(root, subSchema, tree, []);
}

export function parse(schema: any, options?: GenerateOpts): Root {
  const xapiPath =
    options && options.xapiImport ? options.xapiImport : 'jsxapi';
  const role = options && options.role ? options.role : 'Admin';
  const access = options && options.access ? options.access : 'public-api';

  const root = new Root();

  // import ... from ...
  root.addChild(new ImportStatement(xapiPath));

  // Main XAPI class
  root.addMain();

  parseSchema('Command', root, schema, parseCommandTree);
  parseSchema('Config', root, schema, parseConfigTree);
  parseSchema('Status', root, schema, parseStatusTree);

  return root;
}

export function generate(schema: any, options?: GenerateOpts) {
  const root = parse(schema, options);
  return root.serialize();
}
