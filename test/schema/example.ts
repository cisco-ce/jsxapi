import XAPI from '../../src/xapi';

export class TypedXAPI extends XAPI {}

export default TypedXAPI;

export interface TypedXAPI {
  Command: CommandTree;
  Config: ConfigTree;
  Status: StatusTree;
}

export interface CommandTree {
  Audio: {
    Microphones: {
      Mute(): Promise<void>;
    },
    Sound: {
      Play(args: AudioPlayArgs): Promise<void>;
    },
  };
  Dial(args: DialArgs): Promise<any>;
}

export interface DialArgs {
  Number: string;
}

export interface AudioPlayArgs {
  Loop?: 'On' | 'Off';
  Sound: 'Alert' | 'Busy' | 'CallInitiate'
}

export interface ConfigTree {
  SystemUnit: {
    Name: {
      get(): Promise<string>;
      set(name: string): Promise<void>;
    }
  }
}

export interface StatusTree {
  Audio: {
    Volume: {
      get(): Promise<number>;
    }
  }
}
