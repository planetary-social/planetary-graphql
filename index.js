const graphqlServer = require('./src/graphql')
const SSB = require('./src/ssb-server')

const ssb = SSB()
graphqlServer(ssb)
