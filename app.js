const pds = require('./myPds')
const pdsAgent = require('./myPdsAgents')
const pdsReport = require('./myPdsReport')

pds.connectAMI();
pdsAgent.connectAMI();
pdsReport.connectAMI();