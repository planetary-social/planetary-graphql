const { promisify: p } = require('util')
const pull = require('pull-stream')
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
