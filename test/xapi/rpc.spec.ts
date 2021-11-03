import {
  collapse,
  createCommandResponse,
  createGetResponse,
  createRequest,
  createSetResponse,
  createDocumentResponse,
} from '../../src/xapi/rpc';

import { ParameterError, XAPIError } from '../../src/xapi/exc';

describe('xapi/rpc', () => {
  describe('createRequest', () => {
    it('escapes newlines in string parameters', () => {
      const fn = () =>
        createRequest('1', 'xCommand/UserInterface/Message/Echo', {
          Text: 'foo \n bar \n',
        });

      expect(fn).toThrow('may not contain newline');
    });
  });

  describe('createCommandResponse', () => {
    it('handles valid responses', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "OptionKeyListResult":{
              "status":"OK",
              "OptionKey":[{
                "id":"1",
                "Active":{"Value":"False"},
                "Installed":{"Value":"False"},
                "Type":{"Value":"MultiSite"}
              }]
            }
          }
        }
      `);

      expect(createCommandResponse(data)).toEqual({
        status: 'OK',
        OptionKey: [
          {
            id: '1',
            Active: 'False',
            Installed: 'False',
            Type: 'MultiSite',
          },
        ],
      });
    });

    it('handles parameter error', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "OptionKeyRemoveResult":{
              "status":"ParameterError",
              "Type":{
                "Value":"Invalid value"
              }
            }
          }
        }
      `);

      expect(() => createCommandResponse(data)).toThrow(ParameterError);
    });

    it('handles Reason error', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "Result":{
              "status":"Error",
              "Reason":{
                "Value":"Unknown command"
              },
              "XPath":{
                "Value":"/foo/bar"
              }
            }
          }
        }
      `);

      expect(() => createCommandResponse(data)).toThrow('Unknown command');
    });

    it('handles Error error', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "OptionKeyRemoveResult":{
              "status":"Error",
              "Error":{
                "Value":"No Encryption optionkey is installed"
              }
            }
          }
        }
      `);

      expect(() => createCommandResponse(data)).toThrow(
        'No Encryption optionkey is installed',
      );
    });

    it('handles unknown error', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "FooBarResult":{
              "status":"Error",
              "ThisIsNotKnown":{
                "Value": "Some text"
              }
            }
          }
        }
      `);

      expect(() => createCommandResponse(data)).toThrow('FooBarResult');
    });

    it('propagates Error body', () => {
      const data = JSON.parse(`
        {
          "CommandResponse":{
            "OptionKeyRemoveResult":{
              "status":"Error",
              "Error":{
                "Value":"No Encryption optionkey is installed"
              },
              "Messages":[
                {
                  "Message":{"Value":"Message 1"}
                },
                {
                  "Message":{"Value":"Message 2"}
                }
              ]
            }
          }
        }
      `);

      try {
        createCommandResponse(data);
      } catch (error) {
        expect(error).toBeInstanceOf(XAPIError);
        expect(error instanceof XAPIError && error.data).toEqual(
          collapse(data.CommandResponse.OptionKeyRemoveResult),
        );
        return;
      }

      throw new Error('Should not get here');
    });

    describe('handles invalid structure', () => {
      it('no "CommandResponse"', () => {
        const data = JSON.parse(`
          {
            "Foo": "Bar"
          }
        `);

        expect(() => createCommandResponse(data)).toThrow(
          /Missing "CommandResponse" attribute/,
        );
      });

      it('wrong number of keys', () => {
        const data = JSON.parse(`
          {
            "CommandResponse": {},
            "Foo": "Bar",
            "Baz": "Quux"
          }
        `);

        expect(() => createCommandResponse(data)).toThrow(
          /Wrong number of keys/,
        );
      });
    });
  });

  describe('createDocumentResponse', () => {
    it('maps status schema to StatusSchema', () => {
      const request = {
        method: 'xDoc',
        params: {
          Path: ['Stat', 'Audio', 'Volume'],
          Type: 'Schema',
        },
      };

      const data = JSON.parse(`
        {
          "StatusSchema": {
            "Audio": {
              "Volume": {
                "ValueSpace": {
                  "type": "Integer"
                },
                "access": "public-api",
                "description": "Shows the volume level (dB) of the loudspeaker output.",
                "read": "Admin;Integrator;User"
              },
              "VolumeMute": {
                "ValueSpace": {
                  "Value": [
                    "On",
                    "Off"
                  ],
                  "type": "Literal"
                },
                "access": "public-api",
                "description": "Shows whether the endpoint volume is set to mute.",
                "read": "Admin;User"
              }
            }
          }
        }`);

      expect(createDocumentResponse(request, data)).toEqual({
        ValueSpace: { type: "Integer" },
        access: 'public-api',
        description: 'Shows the volume level (dB) of the loudspeaker output.',
        read: 'Admin;Integrator;User',
      });
    });
  });

  describe('createGetResponse', () => {
    it('extracts value from nested object', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xGet',
        id: '2',
        params: { Path: ['Status', 'Audio', 'Volume'] },
      };

      const response = {
        ResultId: '2',
        Status: {
          Audio: {
            Volume: { Value: '30' },
          },
        },
      };

      expect(createGetResponse(request, response)).toEqual('30');
    });

    it('returns undefined for empty responses', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xGet',
        id: '1',
        params: { Path: ['Status', 'Call'] },
      };

      const response = {};

      const result = createGetResponse(request, response);
      expect(result).toBeUndefined();
    });

    it('extracts error responses', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xGet',
        id: '2',
        params: { Path: ['Status', 'Audio', 'Volume'] },
      };

      const body = `
        "Status":{
          "status":"Error",
          "Reason":{
            "Value":"No match on address expression"
          },
          "XPath":{
            "Value":"Status/Audio/Volumee"
          }
        }
      `;

      // Old JSON serialization format
      const responseWithCommandResponse = JSON.parse(`
        {
          "CommandResponse":{ ${body} },
          "ResultId": "2"
        }
      `);

      // New JSON serialization format
      const responseWithoutCommandResponse = JSON.parse(`
        {
          ${body},
          "ResultId": "2"
        }
      `);

      expect(() => createGetResponse(request, responseWithCommandResponse))
        .toThrow('No match on address expression');
      expect(() => createGetResponse(request, responseWithoutCommandResponse))
        .toThrow('No match on address expression');
    });
  });

  describe('createSetResponse', () => {
    it('handles Reason error', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xSet',
        id: '1',
        params: {
          Path: [
            'Configuration',
            'Video',
            'Output',
            'Connector',
            99,
            'MonitorRole',
          ],
          Value: 'foo',
        },
      };
      const response = JSON.parse(`
        {
          "CommandResponse":{
            "Configuration":{
              "status":"Error",
              "Reason":{
                "Value":"No match on address expression."
              },
              "XPath":{
                "Value":"Configuration/Video/Output/Connector[99]/MonitorRole"
              }
            }
          },
          "ResultId":"1"
        }
      `);

      expect(() => createSetResponse(request, response)).toThrow(
        'No match on address expression',
      );
    });

    it('handles Error error', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xSet',
        id: '1',
        params: {
          Path: [
            'Configuration',
            'Video',
            'Output',
            'Connector',
            99,
            'MonitorRole',
          ],
          Value: 'foo',
        },
      };

      const body = `
        "Configuration":{
          "status":"Error",
          "Error":{
            "Value":"No match on address expression."
          },
          "XPath":{
            "Value":"Configuration/Video/Output/Connector[99]/MonitorRole"
          }
        }
      `;

      // Old JSON serialization format
      const responseWithCommandResponse = JSON.parse(`
        {
          "CommandResponse":{ ${body} },
          "ResultId":"1"
        }
      `);

      // New JSON serialization format
      const responseWithoutCommandResponse = JSON.parse(`
        {
          ${body},
          "ResultId":"1"
        }
      `);

      expect(() => createSetResponse(request, responseWithCommandResponse))
        .toThrow('No match on address expression');
      expect(() => createSetResponse(request, responseWithoutCommandResponse))
        .toThrow('No match on address expression');
    });

    it('handles unknown error', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'xSet',
        id: '1',
        params: {
          Path: [
            'Configuration',
            'Video',
            'Output',
            'Connector',
            99,
            'MonitorRole',
          ],
          Value: 'foo',
        },
      };
      const response = JSON.parse(`
        {
          "CommandResponse":{
            "Configuration":{
              "status":"Error",
              "ThisIsNotKnown":{
                "Value":"No match on address expression."
              },
              "XPath":{
                "Value":"Configuration/Video/Output/Connector[99]/MonitorRole"
              }
            }
          },
          "ResultId":"1"
        }
      `);

      expect(() => createSetResponse(request, response)).toThrow(
        'Configuration',
      );
    });
  });
});
