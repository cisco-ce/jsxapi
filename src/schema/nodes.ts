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
  private imports = new Imports();
  private interfaceNames = new Set<string>();
  private main?: MainClass;

  constructor(readonly libName: string = 'jsxapi') {
    super();
    this.addChild(this.imports);
  }

  public addChild<T extends Node>(child: T): T {
    if (child instanceof Interface) {
      if (this.interfaceNames.has(child.name)) {
        throw new Error(`Interface already exists: ${child.name}`);
      }
      this.interfaceNames.add(child.name);
    }
    return super.addChild(child);
  }

  public addImports(path: string, imports: string[]) {
    const fullPath = [this.libName, path].filter((x) => !!x).join('/');
    this.imports.addImports(fullPath, imports);
  }

  public addInterface(name: string, extend: string[] = []): Interface {
    const missing = extend.filter((e) => !this.interfaceNames.has(e));
    if (missing.length) {
      throw new Error(`Cannot add interface ${name} due to missing interfaces: ${missing.join(', ')}`);
    }
    return this.addChild(new Interface(name, extend));
  }

  public addMain(name?: string, options: Partial<MainOptions> = {}): MainClass {
    if (this.main) {
      throw new Error('Main class already defined');
    }
    const main = this.addChild(new MainClass(this, name, options));
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

    this.addImports('lib/xapi/feedback', ['Registration']);
    const registration = new Plain('Registration');
    const listenable = this.addInterface('Listenable<T>');
    const handler = new Function('handler', [['value', new Plain('T')]]);
    listenable.addChildren([
      new Function('on', [['handler', handler]], registration),
      new Function('once', [['handler', handler]], registration),
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
type Eventify<T> = { [P in keyof T]: Eventify<T[P]>; } & Listenable<T>;`;
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

export class Imports extends Node {
  private imports = new Map<string, ImportStatement>();

  public addImports(path: string, imports: string[]) {
    let importStatement = this.imports.get(path);

    if (!importStatement) {
      importStatement = new ImportStatement(path);
      this.imports.set(path, importStatement);
      this.addChild(importStatement);
    }

    importStatement.addImports(imports);
    return importStatement;
  }

  public serialize() {
    return Array.from(this.imports.values())
      .map((i) => i.serialize())
      .join('\n');
  }
}

export class ImportStatement extends Node {
  private imports: Set<string>;

  constructor(readonly moduleName: string, imports?: string[]) {
    super();
    this.imports = new Set(imports || []);
  }

  public addImports(imports: string[]) {
    for (const name of imports) {
      this.imports.add(name);
    }
  }

  public serialize(): string {
    const imports = Array.from(this.imports);
    return `import { ${imports.join(', ')} } from "${this.moduleName}";`;
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

export type Valuespace = Type | string;

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
    readonly args: [string, Type][] = [],
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

export class Interface extends Node implements Type {
  constructor(readonly name: string, readonly extend: string[] = []) {
    super();
  }

  public getType(): string {
    return this.name;
  }

  public allOptional(): boolean {
    return !this.children.some((child) => {
      return !(child instanceof Member) || child.isRequired;
    });
  }

  public serialize(): string {
    const ext = this.extend.length ? ` extends ${this.extend.join(', ')}` : '';
    const tree = renderTree(this.children, ';');
    return `export interface ${this.name}${ext} {${tree}}`;
  }
}

export interface MainOptions {
  base: string;
  withConnect: boolean;
}

export class MainClass extends Interface {
  private connectGen = 'connectGen';
  private readonly options: MainOptions;

  constructor(root: Root, readonly name: string = 'TypedXAPI', options: Partial<MainOptions> = {}) {
    super(name);
    this.options = {
      base: 'XAPI',
      withConnect: true,
      ...options,
    };
    const imports = [this.options.base];
    if (this.options.withConnect) {
      imports.push(this.connectGen);
    }
    root.addImports('', imports);
  }

  public serialize(): string {
    const exports = [`export default ${this.name};`];
    if (this.options.withConnect) {
      exports.push(`export const connect = ${this.connectGen}(${this.name});`);
    }
    return `\
export class ${this.name} extends ${this.options.base} {}

${exports.join('\n')}

${super.serialize()} `;
  }
}

export interface MemberOpts {
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
      docstring: '',
      required: true,
      ...options,
    };
  }

  get isRequired() {
    return this.options.required;
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

export interface CommandOpts {
  docstring: string;
  multiline: boolean;
}

export class Command extends Node {
  private retval?: Type;
  private options: CommandOpts;

  constructor(
    readonly name: string,
    readonly params?: Interface,
    retval?: Valuespace,
    options?: Partial<CommandOpts>,
  ) {
    super();
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
    const hasBody = this.options.multiline;
    if (this.params) {
      const argsType = this.params.getType();
      const optional = !hasBody && this.params.allOptional() ? '?' : '';
      args.push(`args${optional}: ${argsType}`);
    }
    if (hasBody) {
      args.push('body: string');
    }
    const argString = args.join(', ');
    const retval = this.retval ? this.retval.getType() : 'any';
    return `${this.formatDocstring()}${this.name}<R=${retval}>(${argString}): Promise<R>`;
  }
}
