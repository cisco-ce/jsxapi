import XAPI from '../xapi';

export default async function fetch(xapis: XAPI | XAPI[]) {
  xapis = Array.isArray(xapis) ? xapis : [xapis];

  const paths = [
    'Command',
    'Configuration',
    'Event',
    'Status',
  ];

  return await Promise.all(xapis.reduce((reqs: Array<Promise<object>>, xapi) => {
    return [
      ...reqs,
      ...paths.map(async (p) => {
        const doc = await xapi.doc(p);
        const key = p === 'Status' ? 'StatusSchema' : p;
        return { [key]: doc };
      }),
    ];
  }, []));
}
