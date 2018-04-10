import { JSONParser, parseJSON } from '../src/json-parser';


describe('parseJSON', () => {
  it('can parse top-level status', () => {
    expect(parseJSON('{"StatusSchema":null}'))
      .to.deep.equal({ StatusSchema: null });
  });

  it('can parse text', () => {
    expect(parseJSON('{ "StatusSchema": "text" }'))
      .to.deep.equal({ StatusSchema: 'text' });
  });

  it('can parse nested structure', () => {
    expect(parseJSON(`{
      "StatusSchema": {
        "Audio": {
          "Input": null
        }
      }
    }`)).to.deep.equal({
      StatusSchema: {
        Audio: {
          Input: null,
        },
      },
    });
  });

  it('can parse siblings', () => {
    expect(parseJSON(`{
      "StatusSchema": {
        "Audio": null,
        "Call": null
      }
    }`)).to.deep.equal({
      StatusSchema: {
        Audio: null,
        Call: null,
      },
    });
  });

  it('can parse tree', () => {
    expect(parseJSON(`{
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
    }`)).to.deep.equal({
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
    const spy = sinon.spy();

    parser.on('data', spy);

    parser.write('{"Status');
    parser.write('Schema":');
    parser.write('{"Audio"');
    parser.write(': null\n');
    expect(spy).to.not.have.been.called();

    parser.write('}}\n\n  {"Configuration":{');
    expect(spy).to.have.been.calledWithMatch({
      StatusSchema: {
        Audio: null,
      },
    });

    spy.resetHistory();

    parser.write('"Audio');
    parser.write('": null }}');

    expect(spy).to.have.been.calledWithMatch({
      Configuration: {
        Audio: null,
      },
    });
  });

  it('emits error on premature end', () => {
    const spy = sinon.spy();
    const parser = new JSONParser();

    parser.on('error', spy);
    parser.write('{"StatusSchema');
    parser.end();

    expect(spy).to.have.been.called();
  });

  it('can parse consecutive schemas with valuespace', () => {
    const spy = sinon.spy();
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

    expect(spy).to.have.been.calledTwice();
  });

  it('can parse consecutive documents in same write', () => {
    const spy = sinon.spy();
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

    expect(spy).to.have.been.calledTwice();
  });

  it('can handle invalid input in between objects/results', () => {
    const dataSpy = sinon.spy();
    const errorSpy = sinon.spy();
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

    expect(dataSpy).to.have.been.calledTwice();
    expect(errorSpy).to.have.been.calledOnce();
  });
});
