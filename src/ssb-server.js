const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const { join } = require('path')
const pull = require('pull-stream')
const flatMap = require('pull-flatmap')

const DB_PATH = process.env.DB_PATH || join(__dirname, '../db')

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
    .use(require('ssb-room-client'))

    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))

    .use(require('./ssb-room-plugin'))

  return stack({
    keys: ssbKeys.loadOrCreateSync(join(DB_PATH, 'secret')),
    path: DB_PATH,
    friends: { hops: 2 },
    // lan: { legacy: false },

    // TODO - configure connections
    // - ssb-rooms-client: https://github.com/ssbc/ssb-room-client
    // - ssb-config: https://github.com/ssbc/ssb-config/
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

function logging (ssb) {
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
        output.name += ' (my room)'
        return cb(null, output)
      }

      ssb.aboutSelf.get(feedId, (err, details) => {
        if (!err && details.name) output.name = details.name
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

module.exports = function SSB (opts = {}) {
  const ssb = startServer(opts)

  console.log({ feedId: ssb.id })

  if (process.env.LOGGING) logging(ssb)

  ssb.lan.start()

  requestAvatars(ssb)

  return ssb
}
