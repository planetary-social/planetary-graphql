const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const { join } = require('path')
const pull = require('pull-stream')
const flatMap = require('pull-flatmap')
const incomingConnections = require('ssb-config/util/incoming-connections')
const ref = require('ssb-ref')

const DB_PATH = process.env.DB_PATH || join(__dirname, '../db')
const pubs = require('./pubs')
  .map(pub => {
    pub.id = ref.getKeyFromAddress(pub.address)
    return pub
  })

module.exports = function SSB (opts = {}) {
  const ssb = startServer(opts)
  console.log({ feedId: ssb.id })

  if (process.env.LOGGING === 'true') startLogging(ssb)

  ssb.lan.start()

  requestAvatars(ssb)
  setupBootstrapPubs(ssb)

  return ssb
}

function startServer (opts = {}) {
  const stack = SecretStack({ caps })
    .use([
      require('ssb-db2/core'),
      require('ssb-db2/compat/publish'),
      require('ssb-classic'),
      require('ssb-box'),
      // require('ssb-box2'),
      require('ssb-db2/compat/ebt'),
      // require('ssb-db2/compat/post'),
      require('ssb-db2/compat/db')

      // require('ssb-db2/migrate'),
    ])

    .use(require('ssb-friends'))

    .use(require('ssb-lan'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-replication-scheduler'))
    .use([
      require('ssb-room-client/lib/plugin-tunnel'),
      require('ssb-room-client/lib/plugin-room-client'),
      // require('ssb-room-client/lib/plugin-room'),
      require('./plugin-room') // CUSTOM
    ])

    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))

  return stack({
    keys: ssbKeys.loadOrCreateSync(join(DB_PATH, 'secret')),
    path: DB_PATH,

    friends: { hops: 2 },

    connections: {
      incoming: {
        net: incomingConnections({}).net,
        // tunnel: [{ scope: 'public', transform: 'shs' }]
        tunnel: [{ scope: ['device', 'public', 'local'], transform: 'shs' }]
      },
      outgoing: {
        net: [{ transform: 'shs' }],
        tunnel: [{ transform: 'shs' }]
      }
    },
    lan: { legacy: false },

    // References:
    //   https://github.com/ssbc/ssb-room-client
    //   https://github.com/ssbc/ssb-config/
    ...opts
  })
}

function requestAvatars (ssb) {
  const { where, type, toPullStream, live } = ssb.db.operators
  pull(
    ssb.db.query(
      where(type('about')),
      live({ old: true }),
      toPullStream()
    ),
    pull.filter(m => (
      m.value.author === m.value.content.about &&
      m.value.content.image
    )),
    pull.asyncMap((m, cb) => ssb.aboutSelf.get(m.value.author, cb)),
    pull.drain(about => {
      if (about.image) {
        ssb.blobs.has(about.image, (err, hasBlob) => {
          if (err) return console.warn(err)

          if (!hasBlob) ssb.blobs.want(about.image, () => {})
        })
      }
    })
  )
}

function startLogging (ssb) {
  pull(
    ssb.conn.peers(),
    pull.through(() => console.log(' ')),
    flatMap(evs => evs),
    pull.asyncMap((ev, cb) => {
      const { key: feedId, state } = ev[1]

      const output = {
        state,
        name: feedId
      }
      if (output.name === ssb.room.id) {
        output.name = 'ROOM ' + ssb.room.id.slice(0, 10) + '...'
        return cb(null, output)
      }

      ssb.aboutSelf.get(feedId, (err, details) => {
        if (!err && details.name) output.name = details.name
        else {
          const pub = pubs.find(pub => pub.id === feedId)
          if (pub) output.name = pub.name
        }
        cb(null, output)
      })
    }),
    pull.drain(({ state, name }) => {
      state === 'connected'
        ? console.log(`${bold(green(state.padStart(13, ' ')))} - ${green(name)}`)
        : console.log(`${state.padStart(13, ' ')} - ${name}`)
    })
  )

  ssb.db.onMsgAdded(m => {
    if (m.kvt.value.author !== ssb.id) return
    console.log(
      m.kvt.value.sequence,
      JSON.stringify(m.kvt.value.content, null, 2)
    )
  })

  function bold (string) { return '\x1b[1m' + string + '\x1b[0m' }
  function green (string) { return '\x1b[32m' + string + '\x1b[0m' }
}

function setupBootstrapPubs (ssb) {
  for (const pub of pubs) {
    ssb.conn.stage(pub.address, {
      key: ref.getKeyFromAddress(pub.address),
      type: 'pub'
    })
  }

  // NOTE - initially it is not enough to just "stage" pubs for connection,
  // because the default ssb-conn/scheduler checks if the pub is in "hop range"
  // which they are not initially (as no-one is UNLESS we follow pubs, which we don't
  // want - ideally we only follow room members)
  //
  // TODO 2022-12-14 (mix) watch to see if this performs well
  //
  // TODO 2022-12-14 (mix) see if Zach can get the graphql server talking via the room

  autoConnectPubsIfNeeded()
  setInterval(autoConnectPubsIfNeeded, 30 * 1000) // every 30 seconds

  function autoConnectPubsIfNeeded () {
    const count = ssb.conn.query().peersConnected().length
    if (count < 4) connectRandomPub()
  }

  function connectRandomPub () {
    const pub = pubs[Math.floor(pubs.length * Math.random())]

    ssb.conn.connect(pub.address, (err, rpc) => {
      if (err) connectRandomPub()
    })
  }
}
