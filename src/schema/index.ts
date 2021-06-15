import {
  ArrayTree,
  Command,
  Generic,
  List,
  Literal,
  Member,
  Node,
  Plain,
  Root,
  Tree,
  Type,
} from './nodes';

export interface GenerateOpts {
  access: 'public-api' | 'public-api-preview';
  role: 'Admin' | 'User' | 'Integrator' | 'RoomControl';
  mainClass?: string;
  withConnect: boolean;
  xapiImport: string;
}

interface Leaf {
  description?: string;
  ValueSpace: ValueSpace;
}

interface CommandLeaf extends Leaf {
  command?: 'True';
  multiline?: 'True' | 'False';
}

interface EventLeaf extends Leaf {
  type?: 'int' | 'literal' | 'string';
}

interface ValueSpace {
  required: 'True' | 'False';
  type: 'Integer' | 'IntegerArray' | 'Literal' | 'LiteralArray' | 'String' | 'StringArray';
  Value?: string[];
}

function parseEventType(type: EventLeaf['type'], path: string[]): Type {
  switch (type) {
    case 'int':
      return new Plain('number');
    case 'literal':
    case 'string':
      return new Plain('string');
    default:
      throw new Error(`Invalid Event type: ${type}`);
  }
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
  return !!value && (value as CommandLeaf).command === 'True';
}

/**
 * Check if an object is an event definition.
 *
 * Events have { event: 'True' } in the schema - however, the XAPI allows to
 * subscribe even more granularly to attributes of events. We consider a leaf to
 * be the attributes with scalar values.
 */
function isEventLeaf(value: unknown): value is EventLeaf {
  return 'type' in (value as Leaf);
}

/**
 * Check if an object is a configuration definition.
 */
function isLeaf(value: unknown): value is Leaf {
  return 'ValueSpace' in (value as Leaf);
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
      // tslint:disable-next-line no-console
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
      const paramsType = !params.length
        ? undefined
        : root.addInterface(`${fullPath.join('')}Args`);
      if (paramsType) {
        paramsType.addChildren(params);
      }
      tree.addChild(new Command(key, paramsType, undefined, {
        docstring: value.description || '',
        multiline: !!value.multiline && value.multiline === 'True',
      }));
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
    if (isLeaf(value)) {
      const vs = parseValueSpace(value.ValueSpace, fullPath);
      tree.addChild(new Member(key, vs, { docstring: value.description || '' }));
    } else if (Array.isArray(value)) {
      const subTree = tree.addChild(new Tree(key));
      for (const each of value) {
        const id = each.id;
        const idTree = subTree.addChild(new Tree(id));
        parseConfigTree(root, each, idTree, path.concat([key, id]));
      }
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseConfigTree(root, value, subTree, path.concat(key));
    }
  });
}

/**
 * Parse the recursive tree of event definitions.
 */
function parseEventTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
    const fullPath = path.concat(key);
    if (isEventLeaf(value)) {
      const vs = parseEventType(value.type, fullPath);
      tree.addChild(new Member(key, vs, { docstring: value.description || '' }));
    } else if (Array.isArray(value)) {
      const subTree = tree.addChild(new ArrayTree(key));
      for (const item of value) {
        parseEventTree(root, item, subTree, path.concat([key]));
      }
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseEventTree(root, value, subTree, path.concat(key));
    }
  });
}

/**
 * Parse the recursive tree of status definitions.
 */
function parseStatusTree(root: Root, schema: any, tree: Node, path: string[]) {
  forEachEntries(schema, (key, value) => {
    const fullPath = path.concat(key);
    if (isLeaf(value)) {
      const vs = parseValueSpace(value.ValueSpace, fullPath);
      tree.addChild(new Member(key, vs, { docstring: value.description || '' }));
    } else if (Array.isArray(value)) {
      if (value.length !== 1) {
        throw new Error(`error: ${fullPath.join('/')} contains multiple entries`);
      }
      const subTree = tree.addChild(new ArrayTree(key));
      parseStatusTree(root, value[0], subTree, path.concat([key]));
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseStatusTree(root, value, subTree, path.concat(key));
    }
  });
}

/**
 * A parsing function to parse a document subtree.
 */
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
  type: 'Command' | 'Config' | 'Event' | 'Status',
  root: Root,
  schema: any,
  parser: SchemaParser,
) {
  const { rootKey, mkType } = {
    Command: {
      mkType: (t: Type) => t,
      rootKey: 'Command',
    },
    Config: {
      mkType: (t: Type) => new Generic('Configify', t),
      rootKey: 'Configuration',
    },
    Event: {
      mkType: (t: Type) => new Generic('Eventify', t),
      rootKey: 'Event',
    },
    Status: {
      mkType: (t: Type) => new Generic('Statusify', t),
      rootKey: 'StatusSchema',
    },
  }[type];
  const subSchema = schema[rootKey];

  if (!subSchema) {
    return;
  }

  if (typeof subSchema !== 'object') {
    throw new Error(`schema.${type} is not an object`);
  }

  const tree = root.addInterface(`${type}Tree`);
  root.getMain().addChild(new Member(type, mkType(tree)));

  parser(root, subSchema, tree, [type]);
}

/**
 * Parse and generate a module of a schema definition.
 */
export function parse(schema: any, options: Partial<GenerateOpts> = {}): Root {
  const opts: GenerateOpts = {
    access: 'public-api',
    role: 'Admin',
    withConnect: true,
    xapiImport: 'jsxapi',
    ...options,
  };

  const root = new Root(opts.xapiImport);

  // Main XAPI class
  root.addMain(opts.mainClass, { withConnect: opts.withConnect });
  root.addGenericInterfaces();

  parseSchema('Command', root, schema, parseCommandTree);
  parseSchema('Config', root, schema, parseConfigTree);
  parseSchema('Event', root, schema, parseEventTree);
  parseSchema('Status', root, schema, parseStatusTree);

  return root;
}

/**
 * Serialize a TypeScript module from a schema definition.
 */
export function generate(schema: any, options: Partial<GenerateOpts> = {}) {
  const root = parse(schema, options);
  return root.serialize();
}
