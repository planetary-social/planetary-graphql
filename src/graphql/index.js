const { ApolloServer } = require('apollo-server-express')
const {
  ApolloServerPluginLandingPageGraphQLPlayground
} = require('apollo-server-core')

const http = require('http')
const cors = require('cors')
const express = require('express')
const { promisify } = require('util')

const typeDefs = require('./typeDefs')
const SSBResolvers = require('./resolvers')

module.exports = function GraphqlServer (ssb) {
  return async function graphqlServer (opts = { port: 4000 }, cb) {
    if (cb === undefined) return promisify(graphqlServer)(opts)

    const app = express()

    app.use(cors())

    const httpServer = http.createServer(app)
    const resolvers = SSBResolvers(ssb)

    const apolloServer = new ApolloServer({
      cache: 'bounded',
      typeDefs,
      resolvers,
      plugins: [
        ApolloServerPluginLandingPageGraphQLPlayground({ httpServer })
      ]
    })

    ssb.close.hook((close, args) => {
      httpServer.close()
      close(...args)
    })

    apolloServer.start()
      .then(() => {
        apolloServer.applyMiddleware({ app })

        httpServer.listen(opts.port, (err) => {
          if (err) return cb(err)

          console.log(`🚀 Server ready at http://localhost:${opts.port}${apolloServer.graphqlPath}`)

          cb(null, apolloServer)
        })
      })
  }
}
