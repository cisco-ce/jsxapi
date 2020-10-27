import fs from 'fs';
import { parse } from './';
import { filter, merge } from './utils';

export default function generate(schemas: object[]) {
  const fullSchema = schemas.reduce((schema, json) => {
    return merge(schema, filter(json, ['public-api']));
  }, {});

  return parse(fullSchema).serialize();
}

if (module === require.main) {
  if (process.argv.length < 3) {
    throw new Error('usage: <schema.json> ...[schema.json]');
  }

  const json = process.argv.slice(2)
    .map((filename) => {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    });

  // tslint:disable-next-line no-console
  console.log(generate(json));
}
