const pull = require('pull-stream')
const pullParaMap = require('pull-paramap')
const { where, type, descending, toPullStream } = require('ssb-db2/operators')
const { promisify: p } = require('util')
const SSB = require('../../ssb-server')

module.exports = function Resolvers () {
  const ssb = SSB()

  const getProfile = async (id) => {
    const profile = await p(ssb.aboutSelf.get)(id)

    if (!profile) return null
    if (profile.publicWebHosting !== true) return null

    profile.id = id
    return profile
  }

  const getProfiles = ({ limit }) => {
    return new Promise((resolve, reject) => {
      pull(
        ssb.db.query(
          where(
            type('about')
          ),
          descending(), // latest => oldest
          toPullStream()
        ),
        pull.filter(m => m.value.author === m.value.content.about),
        pull.map(m => m.value.author),
        pull.unique(),
        pullParaMap((id, cb) => ssb.aboutSelf.get(id, (err, profile) => {
          if (err) return cb(err)
          profile.id = id
          cb(null, profile)
        }), 5),
        pull.filter(profile => profile.publicWebHosting === true),
        limit ? pull.take(limit) : null,
        pull.collect((err, res) => err ? reject(err) : resolve(res))
      )
    })
  }

  return {
    ssb,
    resolvers: {
      Query: {
        getProfile: (_, opts) => getProfile(opts.id),
        getProfiles: (_, opts) => getProfiles(opts)
      },

      Profile: {
        threads: (parent, { limit, threadMaxSize }) => {
          return new Promise((resolve, reject) => {
            pull(
              ssb.threads.profile({ id: parent.id, reverse: true, threadMaxSize }),
              // TODO: we have to filter to only include messages from those who have opted-in to publicWebHosting
              pull.take(limit || 10),
              pull.collect((err, threads) => {
                if (err) return reject(err)

                const res = threads.map(({ messages }) => {
                  return {
                    id: messages[0].key,
                    messages: messages.map(msg => ({
                      id: msg.key,
                      author: msg.value.author,
                      text: (msg.value.content.text || ''),
                      timestamp: msg.value.timestamp // asserted publish time
                    }))
                  }
                })

                resolve(res)
              })
            )
          })
        },
        followers: (parent) => {
        },
        following: (parent) => {
        }
      },

      Thread: {
        // messages: (parent) => { }
      },

      Comment: {
        author: (parent) => getProfile(parent.author),
        replies: (parent) => {
        },
        votes: (parent) => {
        }
      },

      Vote: {
        author: (parent) => {
        }
      }
    }
  }
}
