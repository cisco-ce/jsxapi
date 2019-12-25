import { JSONParser, parseJSON } from '../src/json-parser';

describe('parseJSON', () => {
  it('can parse top-level status', () => {
    expect(parseJSON('{"StatusSchema":null}')).toEqual({
      StatusSchema: null,
    });
  });

  it('can parse text', () => {
    expect(parseJSON('{ "StatusSchema": "text" }')).toEqual({
      StatusSchema: 'text',
    });
  });

  it('can parse nested structure', () => {
    expect(
      parseJSON(`{
      "StatusSchema": {
        "Audio": {
          "Input": null
        }
      }
    }`),
    ).toEqual({
      StatusSchema: {
        Audio: {
          Input: null,
        },
      },
    });
  });

  it('can parse siblings', () => {
    expect(
      parseJSON(`{
      "StatusSchema": {
        "Audio": null,
        "Call": null
      }
    }`),
    ).toEqual({
      StatusSchema: {
        Audio: null,
        Call: null,
      },
    });
  });

  it('can parse tree', () => {
    expect(
      parseJSON(`{
      "StatusSchema": {
        "Audio": {
          "public": "True",
          "Microphones": {
            "public": "True",
            "LedIndicator": {
              "public": "False"
            },
            "Mute": {
              "public": "True"
            }
          }
        }
      }
    }`),
    ).toEqual({
      StatusSchema: {
        Audio: {
          public: 'True',
          Microphones: {
            public: 'True',
            LedIndicator: {
              public: 'False',
            },
            Mute: {
              public: 'True',
            },
          },
        },
      },
    });
  });
});

describe('Parser', () => {
  it('can parse incremental chunks', () => {
    const parser = new JSONParser();
    const spy = jest.fn();

    parser.on('data', spy);

    parser.write('{"Status');
    parser.write('Schema":');
    parser.write('{"Audio"');
    parser.write(': null\n');
    expect(spy).not.toHaveBeenCalled();

    parser.write('}}\n\n  {"Configuration":{');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      StatusSchema: {
        Audio: null,
      },
    }));

    spy.mockReset();

    parser.write('"Audio');
    parser.write('": null }}');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      Configuration: {
        Audio: null,
      },
    }));
  });

  it('emits error on premature end', () => {
    const spy = jest.fn();
    const parser = new JSONParser();

    parser.on('error', spy);
    parser.write('{"StatusSchema');
    parser.end();

    expect(spy).toHaveBeenCalled();
  });

  it('can parse consecutive schemas with valuespace', () => {
    const spy = jest.fn();
    const parser = new JSONParser();

    parser.on('data', spy);
    parser.write(`{
      "Command": {
        "Update": {
          "command": "True",
          "role": "Admin",
          "public": "False",
          "FilterType": {
            "item": "1",
            "required": "True",
            "type": "Literal",
            "ValueSpace": {
              "type": "Literal",
              "Value": [
                "highpass",
                "highshelf"
              ]
            }
          }
        }
      }
    }`);
    parser.write(`{
      "Configuration": {
        "Mode": {
          "role": "Admin",
          "public": "True",
          "ValueSpace": {
            "type": "Literal",
            "default": "Off",
            "Value": [
              "Off",
              "On"
            ]
          }
        }
      }
    }`);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('can parse consecutive documents in same write', () => {
    const spy = jest.fn();
    const parser = new JSONParser();

    parser.on('data', spy);
    parser.write(`{
      "ResultId": "1",
      "CommandResponse": {
        "StandbyDeactivateResult": {
          "status": "OK"
        }
      }
    }
    {
      "ResultId": "2",
      "Status": {
        "Standby": {
          "Active": {
            "Value": "Off"
          }
        }
      }
    }`);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('can handle invalid input in between objects/results', () => {
    const dataSpy = jest.fn();
    const errorSpy = jest.fn();
    const parser = new JSONParser();

    parser.on('data', dataSpy);
    parser.on('error', errorSpy);

    parser.write(`{
      "ResultId": "1",
      "CommandResponse": {
        "StandbyDeactivateResult": {
          "status": "OK"
        }
      }
    }
    Command not recognized
    {
      "ResultId": "2",
      "Status": {
        "Standby": {
          "Active": {
            "Value": "Off"
          }
        }
      }
    }`);

    expect(dataSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
