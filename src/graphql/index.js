
const { ApolloServer } = require('apollo-server-express')
const { ApolloServerPluginLandingPageGraphQLPlayground } = require('apollo-server-core')

const http = require('http')
const express = require('express')
const cors = require('cors')
const { promisify } = require('util')

const typeDefs = require('./typeDefs')
const Resolvers = require('./resolvers')

module.exports = function GraphqlServer (ssb) {
  return async function graphqlServer (opts = { port: 4000 }, cb) {
    if (cb === undefined) return promisify(graphqlServer)(opts)
  
    const app = express()

    // const graphiqlOrigin = `http://localhost:${port}`
    // const devServerOrigin = `http://localhost:${process.env.DEV_SERVER_PORT || 3000}`

    // app.use(cors({
    //   origin (origin, cb) {
    //     switch (process.env.NODE_ENV) {
    //       case undefined: // if NODE_ENV not set, apply production standards
    //       case 'production':
    //         if (origin === undefined) return cb(null, true)
    //         if (origin === graphiqlOrigin) return cb(null, true)
    //         return cb(new Error('CORS issue')) // give no hints

    //       case 'development':
    //       case 'test':
    //         if (origin === undefined) return cb(null, true)
    //         if (origin === graphiqlOrigin) return cb(null, true)
    //         if (origin === devServerOrigin) return cb(null, true)
    //         return cb(new Error(`CORS issue - unexpected header 'Origin': '${origin}'`))

    //       default:
    //         cb(new Error(`invalid NODE_ENV - ${process.env.NODE_ENV}`))
    //     }
    //   }
    // }))

    const httpServer = http.createServer(app)

    const server = new ApolloServer({
      typeDefs,
      resolvers: Resolvers(ssb),
      plugins: [ApolloServerPluginLandingPageGraphQLPlayground({ httpServer })]
    })

    ssb.close.hook((close, args) => {
      httpServer.close()
      close(...args)
    })
  

    server.start()
      .then(() => {
        server.applyMiddleware({ app })

        httpServer.listen(port, (err) => {
          if (err) return cb(err)

          console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)

          cb(null, server)
        })
      })
  }
}
