import Backend from '../../src/backend';
import XAPI from '../../src/xapi';

describe('Proxy', () => {
  let execute: jest.SpyInstance;
  let xapi: XAPI;

  beforeEach(() => {
    xapi = new XAPI(new Backend(), { seal: false });
    execute = jest.spyOn(xapi, 'execute').mockImplementation(() => Promise.resolve({}));
  });

  describe('command', () => {
    it('can proxy xapi.command', () => {
      xapi.Command.Audio.Volume.Mute();

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xCommand/Audio/Volume/Mute', undefined);
    });

    it('can proxy xapi.command with args', () => {
      xapi.Command.Dial({ Number: 'user@example.com' });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xCommand/Dial', {
        Number: 'user@example.com',
      });
    });
  });

  describe('config', () => {
    it('can proxy xapi.config..get()', () => {
      xapi.Config.Audio.DefaultVolume.get();

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xGet', {
        Path: ['Configuration', 'Audio', 'DefaultVolume'],
      });
    });

    it('can proxy xapi.config..set()', () => {
      xapi.Config.Audio.DefaultVolume.set(50);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xSet', {
        Path: ['Configuration', 'Audio', 'DefaultVolume'],
        Value: 50,
      });
    });

    it('can proxy xapi.config..set() with array index', () => {
      xapi.Config.FacilityService.Service[3].Number.set('user@example.com');

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xSet', {
        Path: ['Configuration', 'FacilityService', 'Service', 3, 'Number'],
        Value: 'user@example.com',
      });
    });

    it('can proxy feedback registration xapi.config..on()', () => {
      const spy = jest.fn();
      xapi.Config.Audio.DefaultVolume.on(spy);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xFeedback/Subscribe', {
        Query: ['Configuration', 'Audio', 'DefaultVolume'],
      });
    });
  });

  describe('event', () => {
    it('can proxy feedback registration xapi.event..on()', () => {
      const spy = jest.fn();
      xapi.Event.Foo.Bar.on(spy);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xFeedback/Subscribe', {
        Query: ['Event', 'Foo', 'Bar'],
      });
    });
  });

  describe('status', () => {
    it('can proxy xapi.status..get()', () => {
      xapi.Status.Audio.Volume.get();

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xGet', {
        Path: ['Status', 'Audio', 'Volume'],
      });
    });

    it('can proxy xapi.status..get() with array index', () => {
      xapi.Status.Video.Input.Connector[2].Type.get();

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xGet', {
        Path: ['Status', 'Video', 'Input', 'Connector', 2, 'Type'],
      });
    });

    it('can proxy feedback registration xapi.status..on()', () => {
      const spy = jest.fn();
      xapi.Status.Audio.Volume.on(spy);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith('xFeedback/Subscribe', {
        Query: ['Status', 'Audio', 'Volume'],
      });
    });
  });
});
