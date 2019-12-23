const chai = require('chai');
const dirtyChai = require('dirty-chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');

// Load plugins
chai.use(dirtyChai);
chai.use(chaiAsPromised);
chai.use(sinonChai);
