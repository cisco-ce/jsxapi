import XAPI from '../xapi';
import { flatten } from './utils';

export default async function fetch(xapis: XAPI | XAPI[]) {
  xapis = Array.isArray(xapis) ? xapis : [xapis];

  const paths = [
    'Command',
    'Configuration',
    'Event',
    'Status',
  ];

  const requests = xapis.map((xapi) => paths.map(async (path) => {
    const doc = await xapi.doc(path);
    const key = path === 'Status' ? 'StatusSchema' : path;
    return { [key]: doc };
  }));

  return await Promise.all(flatten(requests));
}
