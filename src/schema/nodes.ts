import redent from 'redent';

export abstract class Node {
  protected children: Node[];

  constructor() {
    this.children = [];
  }

  public addChild<T extends Node>(child: T): T {
    this.children.push(child);
    return child;
  }

  public addChildren<T extends Node>(children: T[]) {
    this.children = this.children.concat(children);
  }

  public abstract serialize(): string;
}

export class Root extends Node {
  private interfaceNames = new Set<string>();
  private main?: MainClass;

  public addChild<T extends Node>(child: T): T {
    if (child instanceof Interface) {
      if (this.interfaceNames.has(child.name)) {
        throw new Error(`Interface already exists: ${child.name}`);
      }
      this.interfaceNames.add(child.name);
    }
    return super.addChild(child);
  }

  public addInterface(name: string, extend: string[] = []): Interface {
    const missing = extend.filter((e) => !this.interfaceNames.has(e));
    if (missing.length) {
      throw new Error(`Cannot add interface ${name} due to missing interfaces: ${missing.join(', ')}`);
    }
    return this.addChild(new Interface(name, extend));
  }

  public addMain(name?: string, base?: string): MainClass {
    if (this.main) {
      throw new Error('Main class already defined');
    }
    const main = this.addChild(new MainClass(name, base));
    this.main = main;
    return main;
  }

  public getMain(): MainClass {
    if (!this.main) {
      throw new Error('No main class defined');
    }
    return this.main;
  }

  public addGenericInterfaces() {
    const templateParam = new Plain('T');
    const gettable = this.addInterface('Gettable<T>');
    gettable.addChild(
      new Function('get', [], new Generic('Promise', templateParam)),
    );

    const settable = this.addInterface('Settable<T>');
    settable.addChild(
      new Function('set', [['value', templateParam]], new Generic('Promise', 'void')),
    );

    const listenable = this.addInterface('Listenable<T>');
    const handler = new Function('handler', [['value', new Plain('T')]]);
    listenable.addChildren([
      new Function('on', [['handler', handler]]),
      new Function('once', [['handler', handler]]),
    ]);

    this.addChild(new class extends Node {
      public serialize() {
        return `\
type Configify<T> = [T] extends [object]
  ? { [P in keyof T]: Configify<T[P]>; } & Gettable<T> & Listenable<T>
  : Gettable<T> & Settable<T> & Listenable<T>;`;
      }
    }());

    this.addChild(new class extends Node {
      public serialize() {
        return `\
type Statusify<T> = { [P in keyof T]: Statusify<T[P]>; } & Gettable<T> & Listenable<T>;`;
      }
    }());
  }

  public serialize(): string {
    const lines = [];
    for (const child of this.children) {
      lines.push(child.serialize());
    }
    return lines.join('\n\n');
  }
}

export class ImportStatement extends Node {
  private importName = 'XAPI';

  constructor(readonly moduleName: string = 'jsxapi') {
    super();
  }

  public serialize(): string {
    return `import { ${this.importName}, connectGen } from "${this.moduleName}";`;
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

type Valuespace = Type | string;

function vsToType(vs: Valuespace): Type {
  return typeof vs === 'string' ? new Plain(vs) : vs;
}

export interface Type {
  getType(): string;
}

export class Plain implements Type {
  constructor(readonly text: string) {}

  public getType() {
    return this.text;
  }
}

export class Generic implements Type {
  private name: Type;
  private inner: Type;

  constructor(name: Valuespace, inner: Valuespace) {
    this.name = vsToType(name);
    this.inner = vsToType(inner);
  }

  public getType() {
    return `${this.name.getType()}<${this.inner.getType()}>`;
  }
}

export class Function extends Node implements Type {
  constructor(
    readonly name: string,
    readonly args: Array<[string, Type]> = [],
    readonly ret: Type = new Plain('void'),
  ) {
    super();
  }

  public getType(separator: string = ' =>') {
    const args = this.args.map(([n, t]) => `${n}: ${t.getType()}`).join(', ');
    const ret = this.ret.getType();
    return `(${args})${separator} ${ret}`;
  }

  public serialize() {
    return `${this.name}${this.getType(':')}`;
  }
}

export class List implements Type {
  constructor(readonly elementType: Type) {}

  public getType() {
    const elemType = this.elementType.getType();
    const withParens =
      this.elementType instanceof Literal ? `(${elemType})` : elemType;
    return `${withParens}[]`;
  }
}

export class Literal implements Type {
  private members: Type[];

  constructor(...members: Valuespace[]) {
    this.members = members.map((m) => {
      if (typeof m === 'string') {
        return new Plain(`'${m}'`);
      }
      return m;
    });
  }

  public getType() {
    return this.members.map((m) => m.getType()).join(' | ');
  }
}

class Interface extends Node implements Type {
  constructor(readonly name: string, readonly extend: string[] = []) {
    super();
  }

  public getType(): string {
    return this.name;
  }

  public serialize(): string {
    const ext = this.extend.length ? ` extends ${this.extend.join(', ')}` : '';
    const tree = renderTree(this.children, ';');
    return `export interface ${this.name}${ext} {${tree}}`;
  }
}

class MainClass extends Interface {
  constructor(name: string = 'TypedXAPI', readonly base: string = 'XAPI') {
    super(name);
  }

  public serialize(): string {
    return `\
export class ${this.name} extends ${this.base} {}

export default ${this.name};
export const connect = connectGen(${this.name});

${super.serialize()} `;
  }
}

interface MemberOpts {
  docstring: string;
  required: boolean;
}

export class Member extends Node {
  private type: Type;
  private options: MemberOpts;

  constructor(
    readonly name: string,
    type: Valuespace,
    options?: Partial<MemberOpts>,
  ) {
    super();
    this.type = vsToType(type);
    this.options = {
      required: true,
      docstring: '',
      ...options,
    };
  }

  public formatDocstring() {
    if (!this.options.docstring) {
      return '';
    }

    return `/**
${this.options.docstring}
*/
`;
  }

  public serialize(): string {
    const optional = !('required' in this.options) || this.options.required ? '' : '?';
    const name = this.name.match(/^[a-z][a-z0-9]*$/i)
      ? this.name
      : `"${this.name}"`;
    return `${this.formatDocstring()}${name}${optional}: ${this.type.getType()}`;
  }
}

export class Tree extends Node {
  constructor(readonly name: string) {
    super();
  }

  public serialize(): string {
    const tree = renderTree(this.children, ',');
    return `${this.name}: {${tree}}`;
  }
}

export class ArrayTree extends Tree {
  public serialize(): string {
    return `${super.serialize()}[]`;
  }
}

interface CommandOpts {
  docstring: string;
  multiline: boolean;
}

export class Command extends Node {
  private params?: Type;
  private retval?: Type;
  private options: CommandOpts;

  constructor(
    readonly name: string,
    params?: Valuespace,
    retval?: Valuespace,
    options?: Partial<CommandOpts>,
  ) {
    super();
    if (params) {
      this.params = vsToType(params);
    }
    if (retval) {
      this.retval = vsToType(retval);
    }
    this.options = {
      docstring: '',
      multiline: false,
      ...options,
    };
  }

  public formatDocstring(): string {
    if (!this.options || !this.options.docstring) {
      return '';
    }

    return `/**
${this.options.docstring}
*/
`;
  }

  public serialize(): string {
    const args = [];
    if (this.params) {
      const argsType = this.params.getType();
      args.push(`args: ${argsType}`);
    }
    if (this.options && this.options.multiline) {
      args.push('body: string');
    }
    const argString = args.join(', ');
    const retval = this.retval ? this.retval.getType() : 'any';
    return `${this.formatDocstring()}${this.name}<R=${retval}>(${argString}): Promise<R>`;
  }
}
