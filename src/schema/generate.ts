import fs from 'fs';
import { parse } from './';
import { filter, merge } from './utils';

if (process.argv.length < 3) {
  throw new Error('usage: <schema.json> ...[schema.json]');
}

const fullSchema = process.argv.slice(2).reduce((schema, schemafile) => {
  const json = fs.readFileSync(schemafile, 'utf8');
  return merge(schema, filter(JSON.parse(json), ['public-api']));
}, {});

// tslint:disable-next-line no-console
console.log(parse(fullSchema).serialize());
