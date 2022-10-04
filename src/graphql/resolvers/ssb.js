const pull = require('pull-stream')
const pullParaMap = require('pull-paramap')
const { where, type, descending, toPullStream, votesFor, contact } = require('ssb-db2/operators')
const { promisify: p } = require('util')
const toSSBUri = require('ssb-serve-blobs/id-to-url')

module.exports = function Resolvers (ssb) {
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
      pull(
        ssb.db.query(
          where(
            contact(id)
          ),
          descending(), // latest => oldest
          toPullStream()
        ),
        pull.filter(msg => msg.value.content.following),
        pull.map(msg => msg.value.author),
        pull.unique(),
        pull.collect((err, res) => err ? reject(err) : resolve(res))
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
          pull.collect((err, res) => err ? reject(err) : resolve(res))
        )
      })
    })
  }

  /**
   * Gets all the profiles for a given array of profile ids
   * @param {array} ids - array of profile ids
   */
  const getProfilesForIds = (ids) => {
    return new Promise((resolve, reject) => {
      pull(
        pull.values(ids),
        pullParaMap((id, cb) => {
          getProfile(id)
            .then(profile => cb(null, profile))
            .catch(err => cb(err))
        }, 5),
        pull.filter(Boolean),
        // TODO: This removes the profiles that came back as null, we might want to show something in place of that
        // e.g. someone who hasnt opted in to publicWebHosting
        pull.collect((err, res) => err ? reject(err) : resolve(res))
      )
    })
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

  /**
   * Gets all the votes on a message
   * TODO: doesnt handle unlikes and duplicates yet.
   * @param {string} id - id of a message
   */
  const getVotes = (id) => {
    return new Promise((resolve, reject) => {
      pull(
        ssb.db.query(
          where(
            votesFor(id)
          ),
          descending(), // latest => oldest
          toPullStream()
        ),
        pull.map(msg => {
          const vote = msg?.value?.content?.vote
          return {
            author: msg.value.author,
            timestamp: msg.value.timestamp,
            value: vote?.value,
            expression: vote?.expression
          }
        }),
        pull.collect((err, res) => err ? reject(err) : resolve(res))
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
        pullParaMap((msg, cb) => {
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
        pull.collect((err, res) => err ? reject(err) : resolve(res))
      )
    })
  }

  return {
    Query: {
      getProfile: (_, opts) => getProfile(opts.id),
      getProfiles: (_, opts) => getProfiles(opts)
    },

    Profile: {
      image: (parent) => {
        if (!parent.image) return
        return toSSBUri(parent.image, { port: ssbPort })
      },
      threads: (parent, opts) => getThreads(parent.id, opts),
      followers: async (parent) => {
        const ids = await getFollowersIds(parent.id)
        return getProfilesForIds(ids)
      },
      followersCount: async (parent) => {
        const ids = await getFollowersIds(parent.id)
        return ids?.length
      },
      following: async (parent) => {
        const ids = await getFollowingIds(parent.id)
        return getProfilesForIds(ids)
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
