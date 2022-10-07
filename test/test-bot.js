const SecretStack = require('secret-stack')
const ssbKeys = require('ssb-keys')
const path = require('path')
const rimraf = require('rimraf')
const caps = require('ssb-caps')
const { createTestClient } = require('apollo-server-integration-testing')

const GraphqlServer = require('../src/graphql')

let count = 0

// opts.path      (optional)
// opts.name    (optional) - convenience method for deterministic opts.path
// opts.keys      (optional)
// opts.rimraf    (optional) - clear the directory before start (default: true)

function SSB (opts = {}) {
  const dir = opts.path || `/tmp/planetary-graphql-test-${opts.name || count++}`
  if (opts.rimraf !== false) rimraf.sync(dir)

  const keys = opts.keys || ssbKeys.loadOrCreateSync(path.join(dir, 'secret'))

  const stack = SecretStack({ appKey: caps.shs })
    .use([
      require('ssb-db2/core'),
      require('ssb-classic'),
      // require('ssb-box'),
      // require('ssb-box2'),
      // require('ssb-db2/compat/ebt'),
      // require('ssb-db2/compat/post'),
      require('ssb-db2/compat/publish')
      // require('ssb-db2/migrate'),
    ])
    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-friends'))
    // .use(require('ssb-ebt'))
    // .use(require('ssb-conn'))
    // .use(require('ssb-replication-scheduler'))
    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))

  return stack({
    path: dir,
    keys
  })
}

module.exports = async function TestBot (opts = {}) {
  const ssb = SSB(opts)

  // apollo
  const ApolloServer = GraphqlServer(ssb)
  const port = 3000 + count
  const apolloServer = await ApolloServer({ port })
  const apollo = createTestClient({ apolloServer })

  return {
    ssb,
    apollo
  }
}
