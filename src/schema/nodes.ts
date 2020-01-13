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

  addChildren<T extends Node>(children: T[]) {
    this.children = this.children.concat(children);
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

interface Type {
  getType(): string;
}

export class Plain implements Type {
  constructor(readonly text: string) {}

  getType() {
    return this.text;
  }
}

export class Literal implements Type {
  private members: Type[];

  constructor(...members: (Type | string)[]) {
    this.members = members.map((m) => {
      if (typeof m === 'string') {
        return new Plain(m);
      }
      return m;
    });
  }

  getType() {
    const members = this.members.map((m) => m.getType()).join(' | ');
    return `${members}`;
  }
}

export class Interface extends Node implements Type {
  constructor(readonly name: string) {
    super();
  }

  getType(): string {
    return this.name;
  }

  serialize(): string {
    const tree = renderTree(this.children, ';');
    return `export interface ${this.name} {${tree}}`;
  }
}

export class MainClass extends Interface {
  constructor(name: string = 'TypedXAPI', readonly base: string = 'XAPI') {
    super(name);
  }

  serialize(): string {
    return `\
export class ${this.name} extends ${this.base} {}

export default ${this.name};

${super.serialize()} `;
  }
}

export class Member extends Node {
  constructor(
    readonly name: string,
    readonly type: Type,
    readonly options?: { required: boolean },
  ) {
    super();
  }

  serialize(): string {
    const optional = !this.options || this.options.required ? '' : '?';
    return `${this.name}${optional}: ${this.type.getType()}`;
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
  constructor(
    readonly name: string,
    readonly params?: Type,
    readonly retval?: Type,
  ) {
    super();
  }

  serialize(): string {
    const args = this.params ? `args: ${this.params.getType()}` : '';
    const retval = this.retval ? this.retval.getType() : 'any';
    return `${this.name}(${args}): Promise<${retval}>`;
  }
}

export class Config extends Node {
  constructor(readonly name: string, readonly valuespace: Type) {
    super();
    this.addChild(new Command('get', undefined, valuespace));
    this.addChild(new Command('set', valuespace));
  }

  serialize(): string {
    const tree = renderTree(this.children, ',');
    return `${this.name}: {${tree}}`;
  }
}

export class Status extends Node {
  constructor(readonly name: string, readonly valuespace: Type) {
    super();
    this.addChild(new Command('get', undefined, valuespace));
  }

  serialize(): string {
    const tree = renderTree(this.children, ',');
    return `${this.name}: {${tree}}`;
  }
}
