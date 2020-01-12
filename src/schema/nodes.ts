import redent from 'redent';

abstract class Node {
  protected children: Node[];

  constructor() {
    this.children = [];
  }

  addChild<T extends Node>(child: T): T {
    this.children.push(child);
    return child;
  }

  abstract serialize(): string;
}

export class Root extends Node {
  serialize(): string {
    return this.children.map((c) => c.serialize()).join('\n\n');
  }
}

export class ImportStatement extends Node {
  constructor(
    readonly importName: string = 'XAPI',
    readonly moduleName: string = 'jsxapi',
  ) {
    super();
  }

  serialize(): string {
    return `import ${this.importName} from "${this.moduleName}";`;
  }
}

function renderTree(nodes: Node[], terminator: string) {
  const serialized = nodes.map((n) => `${n.serialize()}${terminator}`);
  if (serialized.length) {
    serialized.unshift('');
    serialized.push('');
  }
  return redent(serialized.join('\n'), 2);
}

export class Interface extends Node {
  constructor(readonly name: string) {
    super();
  }

  serialize(): string {
    const tree = renderTree(this.children, ';');
    return `export interface ${this.name} {${tree}}`;
  }
}

export class MainClass extends Interface {
  constructor(
    name: string = 'TypedXAPI',
    readonly base: string = 'XAPI',
  ) {
    super(name);
  }

  serialize(): string {
    return `
export class ${this.name} extends ${this.base} {}

export default ${this.name};

${super.serialize()}
`;
  }
}

export class Member extends Node {
  constructor(readonly name: string, readonly iface: Interface) {
    super();
  }

  serialize(): string {
    return `${this.name}: ${this.iface.name}`;
  }
}

export class Tree extends Node {
  constructor(readonly name: string) {
    super();
  }

  serialize(): string {
    const tree = renderTree(this.children, ',');
    return `${this.name}: {${tree}}`;
  }
}

export class Command extends Node {
  constructor(readonly name: string) {
    super();
  }

  serialize(): string {
    return `${this.name}(): Promise<void>`;
  }
}
