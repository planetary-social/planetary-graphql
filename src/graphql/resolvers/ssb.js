const { promisify: p } = require('util')
const pull = require('pull-stream')
const paraMap = require('pull-paraMap')
const { where, contact, votesFor, toCallback } = require('ssb-db2/operators')
const toSSBUri = require('ssb-serve-blobs/id-to-url')

const SSB = require('../../ssb-server')

module.exports = function Resolvers () {
  const ssb = SSB()

  const ssbPort = ssb.config.serveBlobs && ssb.config.serveBlobs.port

  /**
   * Gets the profile (about) of the given profile id.
   * NOTE: only returns a profile for those who have
   * opted in to publicWebHosting
   * @param {string} id - id of a profile
   */
  const getProfile = async (id) => {
    const profile = await p(ssb.aboutSelf.get)(id)

    if (!profile) return null
    if (profile.publicWebHosting !== true) return null

    profile.id = id
    return profile
  }

  /**
   * Gets all the profile ids of followers of the given profile id
   * @param {string} id - id of a profile
   */
  const getFollowersIds = (id) => {
    return new Promise((resolve, reject) => {
      ssb.db.query(
        where(
          contact(id)
        ),
        toCallback((err, msgs) => {
          if (err) return reject(err)

          pull(
            pull.values(msgs),
            pull.filter(msg => msg.value.content.following),
            pull.map(msg => msg.value.author),
            pull.unique(),
            pull.collect((err, followersIds) => {
              if (err) reject(err)
              else resolve(followersIds)
            })
          )
        })
      )
    })
  }

  /**
   * Gets all the profile ids of those following the given profile id
   * @param {string} id - id of a profile
   */
  const getFollowingIds = (id) => {
    return new Promise((resolve, reject) => {
      ssb.friends.hops({ start: id, max: 1 }, (err, following) => {
        if (err) return reject(err)

        pull(
          pull.values(Object.entries(following)),
          pull.filter(([id, status]) => status === 1),
          pull.map(([id]) => id),
          pull.unique(),
          pull.collect((err, followingIds) => {
            if (err) reject(err)
            else resolve(followingIds)
          })
        )
      })
    })
  }

  /**
   * Gets all the profiles for a given array of profile ids
   * @param {array} ids - array of profile ids
   */
  const getProfiles = (ids) => {
    return new Promise((resolve, reject) => {
      pull(
        pull.values(ids),
        paraMap((id, cb) => {
          getProfile(id)
            .then(profile => cb(null, profile))
            .catch(err => cb(err))
        }, 5),
        pull.filter(Boolean),
        // TODO: This removes the profiles that came back as null, we might want to show something in place of that
        // e.g. someone who hasnt opted in to publicWebHosting
        pull.collect((err, profiles) => {
          if (err) reject(err)
          else resolve(profiles)
        })
      )
    })
  }

  /**
   * Gets all the votes on a message
   * TODO: doesnt handle unlikes and duplicates yet.
   * @param {string} id - id of a message
   */
  const getVotes = (id) => {
    return new Promise((resolve, reject) => {
      ssb.db.query(
        where(
          votesFor(id)
        ),
        toCallback((err, msgs) => {
          if (err) return reject(err)

          pull(
            pull.values(msgs),
            pull.map(msg => {
              const vote = msg?.value?.content?.vote
              return {
                author: msg.value.author,
                timestamp: msg.value.timestamp,
                value: vote?.value,
                expression: vote?.expression
              }
            }),
            pull.collect((err, votes) => {
              if (err) reject(err)
              else resolve(votes)
            })
          )
        })
      )
    })
  }

  /**
   * Gets all the threads initiated by a certain profile id 
   * @param {string} id - id of a profile
   * @param {object} opts - optional parameters
   * @param {int} [opts.limit=10] - max amount of threads to return
   * @param {int} opts.threadMaxSize - max amount of messages in each thread to return
   */
  const getThreads = (id, opts) => {
    const { threadMaxSize, limit = 10 } = opts
    return new Promise((resolve, reject) => {
      pull(
        ssb.threads.profile({ id, reverse: true, threadMaxSize }),
        pull.take(limit),
        pull.collect((err, threads) => {
          if (err) return reject(err)

          const res = threads.map(({ messages }) => {
            return {
              id: messages[0].key,
              messages
            }
          })

          resolve(res)
        })
      )
    })
  }

  /**
   * Takes the messages from a thread and maps them based on whether
   * a profile is returned for the author of that message or not.
   * Messages from someone who hasnt yet opted in to publicWebHosting or
   * a profile wasnt found for them, will return empty values
   * @param {array} messages - messages in a thread
   */
  const mapMessages = (messages) => {
    return new Promise((resolve, reject) => {
      pull(
        pull.values(messages),
        paraMap((msg, cb) => {
          getProfile(msg.value.author)
            .then(profile => {
              // if there was a profile, thats great
              if (profile) {
                return cb(null, {
                  id: msg.key,
                  author: msg.value.author,
                  text: (msg.value.content.text || ''),
                  timestamp: msg.value.timestamp // asserted publish time
                })
              }

              // if their isnt (could be they havent yet opted in to publicWebHosting)
              // we need to return an empty msg instead
              cb(null, {
                id: null,
                text: null,
                timestamp: msg.timestamp,
                author: null
              })
            })
            .catch(err => cb(err))
        }, 5),
        pull.collect((err, messages) => {
          if (err) reject(err)
          else resolve(messages)
        })
      )
    })
  }

  return {
    ssb,
    resolvers: {
      Query: {
        getProfile: (_, opts) => getProfile(opts.id)
      },

      Profile: {
        image: (parent) => toSSBUri(parent.image, { port: ssbPort }),
        threads: (parent, { limit, threadMaxSize }) => getThreads(parent.id, { limit, threadMaxSize }),
        followers: async (parent) => {
          const ids = await getFollowersIds(parent.id)
          return getProfiles(ids)
        },
        followersCount: async (parent) => {
          const ids = await getFollowersIds(parent.id)
          return ids?.length
        },
        following: async (parent) => {
          const ids = await getFollowingIds(parent.id)
          return getProfiles(ids)
        },
        followingCount: async (parent) => {
          const ids = await getFollowingIds(parent.id)
          return ids?.length
        }
      },

      Thread: {
        messages: (parent) => mapMessages(parent.messages)
      },

      Comment: {
        author: (parent) => getProfile(parent.author),
        replies: (parent) => {
        },

        votes: (parent) => getVotes(parent.id),
        votesCount: async (parent) => {
          const votes = await getVotes(parent.id)
          return votes?.length
        }
      },

      Vote: {
        author: (parent) => getProfile(parent.author)
      }
    }
  }
}
