# JSXAPI

[![Build Status](https://travis-ci.com/cisco-ce/jsxapi.svg?branch=master)](https://app.travis-ci.com/github/cisco-ce/jsxapi)

[API Documentation](https://cisco-ce.github.io/jsxapi/)

A set of tools to integrate with the Cisco Telepresence Endpoint APIs in
JavaScript.

## Quick start examples

### Connecting using WebSockets

``` javascript
const jsxapi = require('jsxapi');

jsxapi
  .connect('wss://host.example.com', {
    username: 'admin',
    password: 'password',
  })
  .on('error', console.error)
  .on('ready', async (xapi) => {
    const volume = await xapi.status.get('Audio Volume');
    console.log(`volume is: ${volume}`);
    xapi.close();
  });
```

### Connecting using SSH

``` javascript
const jsxapi = require('jsxapi');

jsxapi
  .connect('ssh://host.example.com', {
    username: 'admin',
    password: 'password',
  })
  .on('error', console.error)
  .on('ready', async (xapi) => {
    const volume = await xapi.status.get('Audio Volume');
    console.log(`volume is: ${volume}`);
    xapi.close();
  });
```

### New style API

The aim of the new style API is to improve readability, while also being more
suited towards automatic type generation and auto-completion.

```javascript
// Set up a call
xapi.Command.Dial({ Number: 'user@example.com' });

// Fetch volume and print it
xapi.Status.Audio.Volume
  .get()
  .then((volume) => { console.log(volume); });

// Set a configuration
xapi.Config.SystemUnit.Name.set('My System');

// Listen to feedback
const off = xapi.Event.Standby.on((event) => {
  // ...
});

// De-register feedback
off();
```

### Old style API

```javascript
// Set up a call
xapi.command('Dial', { Number: 'user@example.com' });

// Fetch volume and print it
xapi.status
  .get('Audio Volume')
  .then((volume) => { console.log(volume); });

// Set a configuration
xapi.config.set('SystemUnit Name', 'My System');

// Listen to feedback
const off = xapi.event.on('Standby', (event) => {
  // ...
});

// De-register feedback
off();
```

## Documentation

The full API documentation can be built by running `npm install` in a `jsxapi`
module directory. Documentation will be located under `docs/` can then be opened
in a browser.

More specifically:

```
mkdir tmp
cd tmp
npm install jsxapi
cd node_modules/jsxapi
npm install
```

Then open `./docs/index.html`.

## Questions and support?

Find more information regarding Cisco's Room Devices over at
[developer.cisco.com](https://developer.cisco.com/site/roomdevices/) or the
[TelePresence and Video](https://supportforums.cisco.com/t5/telepresence/bd-p/5886-discussions-telepresence)
support forums.

Questions about the xAPI, integrations and customizations? Using
[Webex Teams](https://www.webex.com/team-collaboration.html) join the xAPI Devs
space community for realtime support by [clicking this link](https://eurl.io/#rkp76XDrG)
and entering your Webex Teams-registered e-mail address at the prompt.

## Development & Contribution

### Release procedure

Making a release is quite simple:

 * Perform all changes/commits.
 * Determine the version change (`npm help semver`).
 * Update "CHANGELOG.md" with version number, date and change summary.
 * Run `npm version` with the appropriate version bump.
 * Run `npm publish` to push the package version to the registry.
