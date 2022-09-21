const test = require('tape')

const GraphqlServer = require('../src/graphql-server')

test('init', (t) => {
  const ssb = {}
  const graphqlServer = GraphqlServer(ssb)

  const opts = { port: 4000 } // TODO: generate unique port
  graphqlServer(opts, (err, httpServer) => {
    t.error(err, 'starts graphql server with no error')

    t.pass('woo')

    httpServer.close()

    t.end()
  })
})
