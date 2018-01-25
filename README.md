# JSXAPI

A set of tools to integrate with the Cisco Telepresence Endpoint APIs in
JavaScript.

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

## Example with TSH over SSH

```
const jsxapi = require('jsxapi');

// Connect over ssh to a codec
const xapi = jsxapi.connect('ssh://host.example.com', {
  username: 'admin',
  password: 'password',
});

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
off(); // De-register feedback
```
