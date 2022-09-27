const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const { join } = require('path')
const waterfall = require('run-waterfall')

const DB_PATH = join(__dirname, '../db')

const pubs = [
  {
    name: 'cel',
    id: '@5XaVcAJ5DklwuuIkjGz4lwm2rOnMHHovhNg7BFFnyJ8=.ed25519'
  },
  {
    name: 'pub.protozoa.nz',
    id: '@ZPXx+5e+m5KcwI6Qb8fOqjoJyPY4RyeGUzY/s8BVbgY=.ed25519'
  },
  {
    name: 'one.planetary.pub',
    id: '@CIlwTOK+m6v1hT2zUVOCJvvZq7KE/65ErN6yA2yrURY=.ed25519',
    host: 'net:one.planetary.pub:8008~shs:@CIlwTOK+m6v1hT2zUVOCJvvZq7KE/65ErN6yA2yrURY='
  },
  {
    host: 'net:two.planetary.pub:8008:@7jJ7oou5pKKuyKvIlI5tl3ncjEXmZcbm3TvKqQetJIo='
    // invite: 'two.planetary.pub:8008:@7jJ7oou5pKKuyKvIlI5tl3ncjEXmZcbm3TvKqQetJIo=.ed25519~8pETEamsgecH32ry4bj7sr7ofXtUbeOCG1qq4C7szHY='
  },
  {
    host: 'net:159.89.164.120:8008:@LQ8HBiEinU5FiXGaZH9JYFGBGdsB99mepBdh/Smq3VI='
    // invite: '159.89.164.120:8008:@LQ8HBiEinU5FiXGaZH9JYFGBGdsB99mepBdh/Smq3VI=.ed25519~lZItxcdycINquFD1SoeCYtUrLBVlc1zZmz2UAln6TOE=te'
  },
  {
    host: 'net:four.planetary.pub:8008:@5KDK98cjIQ8bPoBkvp7bCwBXoQMlWpdIbCFyXER8Lbw='
    // invite: 'four.planetary.pub:8008:@5KDK98cjIQ8bPoBkvp7bCwBXoQMlWpdIbCFyXER8Lbw=.ed25519~e9ZRXEw0RSTE6FX8jOwWV7yfMRDsAZkzlhCRbVMBUEc='
  },
  {
    host: 'net:gossip.noisebridge.info:8008:@2NANnQVdsoqk0XPiJG2oMZqaEpTeoGrxOHJkLIqs7eY='
    // invite: 'gossip.noisebridge.info:8008:@2NANnQVdsoqk0XPiJG2oMZqaEpTeoGrxOHJkLIqs7eY=.ed25519~JWTC6+rPYPW5b5zCion0gqjcJs35h6JKpUrQoAKWgJ4='
  }
]

module.exports = function SSB (opts = {}) {
  const stack = SecretStack({ caps })
    .use([
      require('ssb-db2/core'),
      require('ssb-classic'),
      // require('ssb-box'),
      // require('ssb-box2'),
      require('ssb-db2/compat/ebt'),
      // require('ssb-db2/compat/post'),
      require('ssb-db2/compat/publish')
      // require('ssb-db2/migrate'),
    ])
    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-friends'))
    .use(require('ssb-ebt'))
    .use(require('ssb-conn'))
    .use(require('ssb-replication-scheduler'))

  const ssb = stack({
    keys: ssbKeys.loadOrCreateSync(join(DB_PATH, 'secret')),
    path: DB_PATH,
    friends: { hops: 3 },
    ...opts
  })

  pubs.forEach(({ name, id, host, invite }) => {
    if (id) {
      waterfall(
        [
          (cb) => ssb.friends.isFollowing({ source: ssb.id, dest: id }, cb),
          (isFollowing, cb) => {
            if (isFollowing) cb(null, null)
            else ssb.friends.follow(id, { state: true }, cb)
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

  return ssb
}
