const fs = require('fs');

function readPkg() {
  const data = fs.readFileSync(__dirname + '/package.json', 'utf8');
  return JSON.parse(data);
}

module.exports = readPkg();
