import redent from 'redent';

export interface GenerateOpts {
  access?: 'public-api' | 'public-api-preview';
  role?: 'Admin' | 'User' | 'Integrator' | 'RoomControl';
  xapiImport?: string;
}

export function generateCommands(schema: any) {
  return `
    export interface CommandTree
    {}
  `;
}

export function generate(schema: any, options?: GenerateOpts) {
  const xapiPath = options && options.xapiImport ? options.xapiImport : 'jsxapi';
  const role = options && options.role ? options.role : 'Admin';
  const access = options && options.access ? options.access : 'public-api';
  return redent(`
    import XAPI from "${xapiPath}";

    export class TypedXAPI extends XAPI {}

    export default TypedXAPI;

    export interface TypedXAPI {
      Command: CommandTree;
      Config: ConfigTree;
      Status: StatusTree;
    }

    ${generateCommands(schema.Command)}

    export interface ConfigTree {
    }

    export interface StatusTree {
    }
  `);
}
