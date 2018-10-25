import {
  collapse,
  createCommandResponse,
  createGetResponse,
  createRequest,
} from '../../src/xapi/rpc';

import {
  ParameterError,
  XAPIError,
} from '../../src/xapi/exc';


describe('xapi/rpc', () => {
  describe('createRequest', () => {
    it('escapes newlines in string parameters', () => {
      const fn = () => createRequest(
        '1',
        'xCommand/UserInterface/Message/Echo',
        { Text: 'foo \n bar \n' });

      expect(fn).to.throw('may not contain newline');
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

      expect(createCommandResponse(data)).to.deep.equal({
        status: 'OK',
        OptionKey: [{
          id: '1',
          Active: 'False',
          Installed: 'False',
          Type: 'MultiSite',
        }],
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

      expect((() => createCommandResponse(data))).to.throw(ParameterError);
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

      expect(() => createCommandResponse(data))
        .to.throw(XAPIError, 'Unknown command');
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

      expect(() => createCommandResponse(data))
        .to.throw(XAPIError, 'No Encryption optionkey is installed');
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

      expect(() => createCommandResponse(data))
        .to.throw(XAPIError, 'FooBarResult');
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
        expect(error).to.be.an.instanceof(XAPIError);
        expect(error.data).to.deep.equal(
          collapse(data.CommandResponse.OptionKeyRemoveResult),
        );
        return;
      }

      expect.fail();
    });

    describe('handles invalid structure', () => {
      it('no "CommandResponse"', () => {
        const data = JSON.parse(`
          {
            "Foo": "Bar"
          }
        `);

        expect(() => createCommandResponse(data))
          .to.throw(XAPIError, /Missing "CommandResponse" attribute/);
      });

      it('wrong number of keys', () => {
        const data = JSON.parse(`
          {
            "CommandResponse": {},
            "Foo": "Bar",
            "Baz": "Quux"
          }
        `);

        expect(() => createCommandResponse(data))
          .to.throw(XAPIError, /Wrong number of keys/);
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

      expect(createGetResponse(request, response))
        .to.equal('30');
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
      expect(result).to.not.exist(result);
    });
  });
});
