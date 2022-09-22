const SecretStack = require('secret-stack')
// const { createTestClient } = require('apollo-server-testing')

const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const path = require('path')

// const GraphqlServer = require('../src/graphql-server')

const DB_PATH = __dirname + '/db'

function createSbot (opts) {
  const ssb = SecretStack({ caps })
    .use(require('ssb-db2'))
    .use(require('ssb-db2/compat')) // include all compatibility plugins
    // .use(require('ssb-friends'))
    .use(require('ssb-ebt'))
    .use(require('ssb-about-self'))
    // .use(require('ssb-replication-scheduler'))
    // .use(require('ssb-conn'))
    .call(null, {
      path: DB_PATH,
      friends: {
          hops: 3
      },
      // the server has an identity
      keys: ssbKeys.loadOrCreateSync(path.join(DB_PATH, 'secret'))
    })
  
  return ssb
}

// function followAndConnect (ssb, cb) {
//   sbot.friends.follow(PUBS.cel.id, null, (err, res) => {
//     if (err) console.log(err)

//     console.log('follow pub', res)

//     sbot.conn.connect(PUBS.cel.host, (err, ssb) => {
//       if (err) console.log(err)

//       console.log('connected', ssb.id)
//     })
//   })
// }

module.exports = function TestBot (opts = {}) {
  const ssb = createSbot(opts)
  // const graphqlServer = await GraphqlServer(ssb)({ port: 4000 })
  // const apollo = createTestClient(graphqlServer)

  return {
    ssb,
    // apollo
  }
}
