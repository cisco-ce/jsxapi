import {
  Node,
  Root,
  ImportStatement,
  Tree,
  Member,
  Command,
  Plain,
  Literal,
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
  type: 'Integer' | 'Literal' | 'String';
  Value?: string[];
}

function parseValueSpace(valuespace: ValueSpace) {
  switch (valuespace.type) {
    case 'Integer':
      return new Plain('number');
    case 'String':
      return new Plain('string');
    case 'Literal':
      if (!valuespace.Value) {
        throw new Error('Missing literal valuespace values');
      }
      if (!valuespace.Value.length) {
        throw new Error('Empty literal valuespace values');
      }
      return new Literal(...valuespace.Value);
  }
}

function isLeaf(value: unknown): value is Leaf {
  return (value as Leaf).command === 'True';
}

function isAttr(key: string): boolean {
  return !!key.match(/^[a-z]/);
}

function parseParameters(command: Leaf): Member[] {
  const params: Member[] = [];

  for (const [param, props] of Object.entries(command)) {
    if (isAttr(param)) {
      // skip lowercase props
      continue;
    }
    const valuespace = parseValueSpace(props.ValueSpace);
    params.push(new Member(param, valuespace));
  }

  return params;
}

function parseCommandTree(root: Root, tree: Node, schema: any, path: string[]) {
  for (const [key, value] of Object.entries(schema)) {
    if (isAttr(key)) {
      continue;
    }
    if (isLeaf(value)) {
      const params = parseParameters(value);
      if (!params.length) {
        tree.addChild(new Command(key));
      } else {
        const fullPath = path.concat(key).join('');
        const paramsType = root.addInterface(`${fullPath}Args`);
        paramsType.addChildren(params);
        tree.addChild(new Command(key, paramsType));
      }
    } else {
      const subTree = tree.addChild(new Tree(key));
      parseCommandTree(root, subTree, value, path.concat(key));
    }
  }
}

function parseCommands(root: Root, schema: any) {
  if (!schema) {
    return;
  }

  if (typeof schema !== 'object') {
    throw new Error('Schema.Command is not an object');
  }

  const commandTree = root.addInterface('CommandTree');
  root.getMain().addChild(new Member('Command', commandTree));

  parseCommandTree(root, commandTree, schema, []);
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

  parseCommands(root, schema.Command);

  return root;
}

export function generate(schema: any, options?: GenerateOpts) {
  const root = parse(schema, options);
  return root.serialize();
}
