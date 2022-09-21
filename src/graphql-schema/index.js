const typeDefs = require('./typeDefs')
const Resolvers = require('./resolvers')

module.exports = (ssb) => {
  const { resolvers, gettersWithCache } = Resolvers(ssb)

  return {
    typeDefs,
    resolvers,
    gettersWithCache
  }
}
