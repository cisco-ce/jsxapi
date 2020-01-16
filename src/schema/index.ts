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
  Type,
  Config,
} from './nodes';

export interface GenerateOpts {
  access?: 'public-api' | 'public-api-preview';
  role?: 'Admin' | 'User' | 'Integrator' | 'RoomControl';
  xapiImport?: string;
}

interface CommandLeaf {
  command?: string;
  ValueSpace: ValueSpace;
}

interface ConfigLeaf {
  ValueSpace: ValueSpace;
}

interface ValueSpace {
  required: 'True' | 'False';
  type: 'Integer' | 'IntegerArray' | 'Literal' | 'LiteralArray' | 'String' | 'StringArray';
  Value?: string[];
}

/**
 * Parse a valuespace into a Type definition.
 */
function parseValueSpace(valuespace: ValueSpace, path: string[]): Type {
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

/**
 * Check if an object is a command definition.
 *
 * Command have { command: 'True' } in the schema.
 */
function isCommandLeaf(value: unknown): value is CommandLeaf {
  return (value as CommandLeaf).command === 'True';
}

/**
 * Check if an object is a configuration definition.
 */
function isConfigLeaf(value: unknown): value is ConfigLeaf {
  return 'ValueSpace' in (value as ConfigLeaf);
}

/**
 * Check if a key of an object is considered an attribute and not a child node.
 *
 * The schema convention is that all keys starting with lowercase are considered
 * attributes.
 */
function isAttr(key: string): boolean {
  return !!key.match(/^[a-z]/);
}

function forEachEntries(
  schema: any,
  visitor: (key: string, value: any) => void,
) {
  Object.entries(schema)
    .filter(([key]) => !isAttr(key))
    .forEach(([key, value]) => visitor(key, value));
}

/**
 * Parse command parameters.
 */
function parseParameters(command: CommandLeaf, path: string[]): Member[] {
  const params: Member[] = [];

  forEachEntries(command, (key, value) => {
    const fullPath = path.concat(key);
    try {
      const ps = Array.isArray(value) ? value[0] : value;
      const valuespace = parseValueSpace(ps.ValueSpace, fullPath);
      const required = ps.required === 'True';
      params.push(new Member(key, valuespace, { required }));
    } catch (error) {
      console.error(`warning: '${fullPath.join('/')}' error parsing valuespace: ${error}`);
    }
  });

  return params;
}

/**
 * Parse the recursive tree of command definitions.
 */
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

/**
 * Parse the recursive tree of configuration definitions.
 */
function parseConfigTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
    const fullPath = path.concat(key);
    if (isConfigLeaf(value)) {
      const vs = parseValueSpace(value.ValueSpace, fullPath);
      tree.addChild(new Config(key, vs));
    } else if (Array.isArray(value)) {
      console.error(`warn: ${fullPath.join('/')} arrays not yet supported`);
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseConfigTree(root, value, subTree, path.concat(key));
    }
  });
}

/**
 * Parse the recursive tree of status definitions.
 */
function parseStatusTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
  });
}

type SchemaParser = (root: Root, schema: any, tree: Tree, path: string[]) => void;

/**
 * Generic function to parse a schema tree.
 *
 * @type The type of document to parse in the schema.
 * @root The root node of the generated module.
 * @schema Full schema definition.
 * @parser A parsing function to parse a subtree of 'type'.
 */
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

/**
 * Parse and generate a module of a schema definition.
 */
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
  root.addGenericInterfaces();

  parseSchema('Command', root, schema, parseCommandTree);
  parseSchema('Config', root, schema, parseConfigTree);
  parseSchema('Status', root, schema, parseStatusTree);

  return root;
}

/**
 * Serialize a TypeScript module from a schema definition.
 */
export function generate(schema: any, options?: GenerateOpts) {
  const root = parse(schema, options);
  return root.serialize();
}
