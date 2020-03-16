/*
 * This scripts write version info to ./src/version.ts to match package.json.
 */

const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');
const dest = path.join(__dirname, 'src/version.ts');

fs.writeFileSync(dest, `/*
 * DO NOT WRITE OR UPDATE THIS FILE!
 * This file was automatically generated at: ${new Date().toISOString()}
 */
const VERSION = '${version}';
export default VERSION;
`);
