const graphqlServer = require('./src/graphql')

if (process.env.NODE_ENV === 'test') {
  module.exports = graphqlServer
} else {
  graphqlServer()
}
