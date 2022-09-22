
const { ApolloServer } = require('apollo-server-express')
const {
  ApolloServerPluginLandingPageGraphQLPlayground
} = require('apollo-server-core')

const http = require('http')
const express = require('express')
const { promisify } = require('util')

const typeDefs = require('./typeDefs')
const SSBResolvers = require('./resolvers/ssb')

module.exports = async function graphqlServer (opts = { port: 4000 }, cb) {
  if (cb === undefined) return promisify(graphqlServer)(opts)

  const app = express()
  const httpServer = http.createServer(app)
  const { ssb, resolvers } = SSBResolvers()

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground({ httpServer }),
      {
        async serverWillStart () {
          return {
            async serverWillStop () {
              console.log('stopping')
              ssb.close()
            }
          }
        }
      }
    ]
  })

  // TODO: could just close the httpServer in serverWillStop
  ssb.close.hook((close, args) => {
    httpServer.close()
    close(...args)
  })

  server.start()
    .then(() => {
      server.applyMiddleware({ app })

      httpServer.listen(opts.port, (err) => {
        if (err) return cb(err)

        console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)

        cb(null, server)
      })
    })
}
