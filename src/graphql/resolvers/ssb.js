const { promisify: p } = require('util')
const pull = require('pull-stream')
const paraMap = require('pull-paraMap')
const { where, contact, toCallback,  } = require('ssb-db2/operators')

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

  return {
    ssb,
    resolvers: {
      Query: {
        getProfile: (_, opts) => getProfile(opts.id)
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
        followers: async (parent) => {
          return new Promise((resolve, reject) => {
            ssb.db.query(
              where(
                  contact(parent.id)
              ),
              toCallback((err, msgs) => {
                  if (err) return reject(err)

                  pull(
                    pull.values(msgs),
                    pull.filter(msg => msg.value.content.following),
                    pull.map(msg => msg.value.author),
                    pull.unique(),
                    // TODO: limit?
                    paraMap((id, cb) => {
                      getProfile(id)
                        .then(profile => cb(null, profile))
                        .catch(err => cb(err))
                    }, 5),
                    pull.filter(Boolean),
                    // TODO: This removes the profiles that came back as null, we might want to show something in place of that
                    // e.g. someone who hasnt opted in to publicWebHosting
                    pull.collect((err, followers) => {
                      if (err) reject(err)
                      else resolve(followers)
                    })
                  )
              })
            )
          })
        },
        following: (parent) => {
          return new Promise((resolve, reject) => {
            ssb.friends.hops({ start: parent.id, max: 1 }, (err, following) => {
              if (err) return reject(err)

              pull(
                pull.values(Object.entries(following)),
                pull.filter(([id, status]) => status === 1),
                pull.map(([id]) => id),
                pull.unique(),
                // TODO: limit?
                paraMap((id, cb) => {
                  getProfile(id)
                    .then(profile => cb(null, profile))
                    .catch(err => cb(err))
                }, 5),
                pull.filter(Boolean),
                // TODO: This removes the profiles that came back as null, we might want to show something in place of that
                // e.g. someone who hasnt opted in to publicWebHosting
                pull.collect((err, following) => {
                  if (err) reject(err)
                  else resolve(following)
                })
              )
            })
          })
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
