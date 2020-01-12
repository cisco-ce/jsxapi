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
    return this.children.map((c) => c.serialize()).join('\n');
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

export class MainClass extends Node {
  private iface: Interface;

  constructor(
    readonly name: string = 'TypedXAPI',
    readonly base: string = 'XAPI',
  ) {
    super();
    this.iface = new Interface(name);
  }

  serialize(): string {
    return `
export class ${this.name} extends ${this.base} {}

export default ${this.name};

${this.iface.serialize()}
`;
  }
}

export class Interface extends Node {
  constructor(readonly name: string) {
    super();
  }

  serialize(): string {
    const properties = this.children.map(c => c.serialize());
    if (properties.length) {
      properties.unshift('');
      properties.push('');
    }
    const propString = redent(properties.join('\n'), 2);
    return `export interface ${this.name} {${propString}}`;
  }
}

class Tree extends Node {
  serialize(): string {
    return '<Tree>';
  }
}

export class Command extends Node {
  constructor(readonly name: string) {
    super();
  }

  serialize(): string {
    return `${this.name}(): Promise<void>;`;
  }
}
