
require('dotenv').config()
const { ApolloServer } = require('apollo-server-express')
const {
  ApolloServerPluginLandingPageGraphQLPlayground
} = require('apollo-server-core')

const http = require('http')
const cors = require('cors')
const express = require('express')
const { promisify } = require('util')

const typeDefs = require('./typeDefs')
const SSBResolvers = require('./resolvers/ssb')

module.exports = function GraphqlServer (ssb) {
  return async function graphqlServer (opts = { port: 4000 }, cb) {
    if (cb === undefined) return promisify(graphqlServer)(opts)

    const app = express()

    app.use(cors({
      origin (origin, cb) {
        switch (process.env.NODE_ENV) {
          case undefined: // if NODE_ENV not set, apply production standards
          case 'production':
          case 'staging':
            // if (origin === undefined) return cb(null, true)

            // Graphql
            if (origin === `http://127.0.0.1:${opts.port}`) return cb(null, true)
            if (origin === `http://localhost:${opts.port}`) return cb(null, true)
            if (origin === `http://157.230.72.191:${opts.port}`) return cb(null, true)

            // Vite
            if (origin === 'https://planetary-social.github.io/rooms-frontend') return cb(null, true)

            return cb(new Error('CORS issue')) // give no hints

          case 'development':
          case 'test':
            // if (origin === undefined) return cb(null, true)

            // Graphql
            if (origin === `http://localhost:${opts.port}`) return cb(null, true)
            if (origin === `http://127.0.0.1:${opts.port}`) return cb(null, true)

            // Vite
            if (origin === 'http://localhost:5173') return cb(null, true)
            if (origin === 'http://127.0.0.1:5173') return cb(null, true)

            return cb(new Error(`CORS issue - unexpected header 'Origin': '${origin}'`))

          default:
            cb(new Error(`invalid NODE_ENV - ${process.env.NODE_ENV}`))
        }
      },
      credentials: true // NOTE: required by the frond end when credentials=include for remote origin
    }))

    const httpServer = http.createServer(app)
    const resolvers = SSBResolvers(ssb)

    const apolloServer = new ApolloServer({
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
