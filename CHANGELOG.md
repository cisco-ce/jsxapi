Changes
-------

##### v4.2.0 (2018-10-31)

  * Change array dispatching to only dispatch once per array element
  * Update dependencies
  * Properly report uknown error types (previously reported as "Reason for XAPIError must be a string"
  * Fix bug where ssh not always reports closing events

##### v4.1.3 (2018-04-10)

  * Avoid circular dependencies in imports

#### v4.1.2 (2018-02-01)

  * Support boolean and number as command/config parameter values

#### v4.1.1 (2018-02-01)

  * Fix issue with setting log level in the cli

#### v4.1.0 (2018-02-01)

  * Support multiple call signatures for `connect`
  * Properly handle SSH "close" events

#### v4.0.0/v4.0.1 (2018-01-25)

  * Initial public version.

#### v3.2.6 (2017-12-13)

  * Fix quoting issue in TSH backend

#### v3.2.5 (2017-12-13)

  * Better feedback detection of messages

#### v3.2.4 (2017-12-01)

  * Fix issue with TSH initialization

#### v3.2.3 (2017-12-01)

  * Updates to dependency chain, npm-shrinkwrap.json

#### v3.2.2 (2017-12-01)

  * Update logging library to resolve debugging issues on Node.

#### v3.2.1 (2017-11-30)

  * Add option to specify log level in `connect`.

#### v3.2.0 (2017-10-14)

  * Add API to allow clients to intercept feedback.

#### v3.1.1 (2017-09-12)

  * Assert that parameters do not include newline characters.

#### v3.1.0 (2017-09-11)

  * More graceful handling of intermittent non-JSON output from TSH.

#### v3.0.3 (2017-09-08)

  * Fix issue with Buffer encoding in json parser

#### v3.0.2 (2017-09-06)

  * Fix WebSocket backend so that it doesn't emit error on error responses.

#### v3.0.1 (2017-08-22)

  * Add API changes supposed to go in v3.0.0.
  * Improve the feedback and feedback group concept. See docs.

#### v3.0.0 (2017-08-21) !incomplete

  * Remove direct support for internal mode.
  * Add support for running remote command for users without `tsh` login shell.

#### v2.1.3 (2017-06-06)

  * Return `undefined` instead of error for responses without proper object
    path.

#### v2.1.2 (2017-05-18)

  * Fix feedback path registration with indexes.

#### v2.1.1 (2017-04-19)

  * Fix `createCommandResponse` so that it handles "Error" errors.

#### v2.1.0 (2017-04-13)

From v1.4.0:

  * Add support for multiple values for same parameter name (arrays).

```
xapi.command('UserManagement User Add', {
  Username: 'foo',
  Role: ['Admin', 'User'],
});
```

#### v2.0.0 (2017-03-29)

  * New API structure:

```
  // Commands should remain the same.
  xapi.command('...', { ... });

  // Events has only feedback.
  xapi.event.on('...', handler);

  // Statuses has feedback and retrieval.
  xapi.status.on('...', handler);
  xapi.status.get('...').then(v => { ... });

  // Config has feedback, retrieval and can be updated.
  xapi.config.on('...', handler);
  xapi.config.get('...').then(v => { ... });
  xapi.config.set('...', value);
```

#### v1.3.2 (2016-12-08)

  * Add `.close()` to StreamTransport.

#### v1.3.1 (2016-11-24)

  * Throw custom errors for better error reporting.

#### v1.3.0 (2016-11-23)

  * Add WebSocket backend.

#### v1.2.3 (2016-11-03)

  * Pass feedback root payload to all event listeners as second argument.

#### v1.2.2 (2016-11-02)

  * Do not exclude lower-case attributes in feedback and command responses.

#### v1.2.1 (2016-10-17)

  * Improve error handling in backend base class.

#### v1.2.0 (2016-10-13)

  * Pass `connect` options down through the stack.

#### v1.1.2 (2016-10-12)

  * Allow registering feedback to list/arrays.
  * Handle ghost feedback.
  * Do not emit feedback for lower case properties.
  * Fix issues with broken .once().

#### v1.1.1 (2016-10-07)

  * Fix issues with running the cli.
  * Add -V, --version to command line opts.

#### v1.1.0 (2016-10-07)

  * Support evaluation of script files in command line interface.
  * Deprecate .toXML().

#### v1.0.1 (2016-09-02)

  * Add space after length specifier in tsh multi-line format.

#### v1.0.0 (2016-08-31)

  * Initial release.
