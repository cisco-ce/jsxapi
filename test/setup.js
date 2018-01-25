import chai from 'chai';
import dirtyChai from 'dirty-chai';
import chaiAsPromised from 'chai-as-promised';
import chaiProperties from 'chai-properties';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import logger from '../src/log';

logger.disableAll();


// Load plugins
global.expect = chai.expect;
chai.use(dirtyChai);
chai.use(chaiAsPromised);
chai.use(chaiProperties);
chai.use(sinonChai);


// Expose globals for all tests
global.sinon = sinon;
