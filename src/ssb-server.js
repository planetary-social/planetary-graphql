const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const { join } = require('path')
const waterfall = require('run-waterfall')
const pull = require('pull-stream')
const flatMap = require('pull-flatmap')

const peers = require('./peers')
const DB_PATH = join(__dirname, '../db')

function startServer (opts = {}) {
  const stack = SecretStack({ caps })
    .use([
      require('ssb-db2/core'),
      require('ssb-db2/compat/publish'),
      require('ssb-classic'),
      // require('ssb-box'),
      // require('ssb-box2'),
      require('ssb-db2/compat/ebt'),
      // require('ssb-db2/compat/post'),
      require('ssb-db2/compat/db')

      // require('ssb-db2/migrate'),
    ])
    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-friends'))
    .use(require('ssb-lan'))
    .use(require('ssb-conn'))
    .use(require('ssb-ebt'))
    .use(require('ssb-replication-scheduler'))
    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))
    .use(require('./ssb-room-plugin'))

  return stack({
    keys: ssbKeys.loadOrCreateSync(join(DB_PATH, 'secret')),
    path: DB_PATH,
    friends: { hops: 6 },
    // lan: { legacy: false },
    ...opts
  })
}

function seedReplication (ssb) {
  peers.forEach(({ name, id, host, invite }) => {
    if (id) {
      waterfall(
        [
          (cb) => ssb.friends.isFollowing({ source: ssb.id, dest: id }, cb),
          (isFollowing, cb) => {
            if (isFollowing) cb(null, null)
            else ssb.friends.follow(id, { state: true }, cb)
          },
          (data, cb) => {
            if (invite) ssb.invite.use(invite, cb)
            else cb(null, null)
          },
          (data, cb) => {
            if (host) ssb.conn.connect(host, cb)
            else cb(null)
          }
        ],
        (err, connection) => {
          if (err) console.error(err)
        }
      )
    }
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
      const feedId = ev[1].key
      ssb.aboutSelf.get(feedId, (err, details) => {
        cb(null, {
          state: ev[1].state,
          name: err ? feedId : (details.name || feedId)
        })
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
  seedReplication(ssb)

  requestAvatars(ssb)

  return ssb
}
