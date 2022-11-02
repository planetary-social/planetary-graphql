const fetch = require('node-fetch')
const pull = require('pull-stream')
const pullParaMap = require('pull-paramap')
const { where, type, descending, toPullStream, votesFor, and, slowEqual } = require('ssb-db2/operators')
const { promisify: p } = require('util')
const toSSBUri = require('../../lib/to-ssb-uri')

const ROOM_URL = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
? `http://localhost:3000`
: process.env.ROOM_URL

module.exports = function Resolvers (ssb) {
  const BLOB_PORT = ssb.config.serveBlobs && ssb.config.serveBlobs.port

  /**
   * Gets the profile (about) of the given feed id.
   * NOTE: only returns a profile for those who have
   * opted in to publicWebHosting
   * @param {string} feedId - feedId of a user
   */
  const getProfile = async (feedId) => {
    const profile = await p(ssb.aboutSelf.get)(feedId)

    if (!profile) return null
    if (profile.publicWebHosting !== true) return null

    profile.id = feedId
    return profile
  }

  /**
   * Gets all the feed ids of followers of the given feed id
   * @param {string} feedId - feedId of a user
   */
  const getFollowersIds = (feedId) => {
    return new Promise((resolve, reject) => {
      ssb.friends.hops({ start: feedId, max: 1, reverse: true }, (err, followers) => {
        if (err) return reject(err)
        else {
          const followerIds = Object.entries(followers)
            .filter(([_, status]) => status === 1)
            .map(([id]) => id)

          resolve(followerIds)
        }
      })
    })
  }

  /**
   * Gets all the feed ids of those following the given feed id
   * @param {string} feedId - feedId of a user
   */
  const getFollowingIds = (feedId) => {
    return new Promise((resolve, reject) => {
      ssb.friends.hops({ start: feedId, max: 1 }, (err, following) => {
        if (err) return reject(err)
        else {
          const followingIds = Object.entries(following)
            .filter(([id, status]) => status === 1)
            .map(([id]) => id)

          resolve(followingIds)
        }
      })
    })
  }

  /**
   * Gets all the profiles for a given array of feed ids
   * @param {array} feedIds - array of feed ids
   */
  const getProfilesForIds = (feedIds) => {
    return new Promise((resolve, reject) => {
      pull(
        pull.values(feedIds),
        pullParaMap((feedId, cb) => {
          getProfile(feedId)
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
        pullParaMap((feedId, cb) => {
          getProfile(feedId)
            .then(profile => cb(null, profile))
            .catch(err => cb(err))
        }, 5),
        pull.filter(Boolean),
        // TODO: This removes the profiles that came back as null, we might want to show something in place of that
        // e.g. someone who hasnt opted in to publicWebHosting
        limit ? pull.take(limit) : null,
        pull.collect((err, res) => err ? reject(err) : resolve(res))
      )
    })
  }

  /**
   * Gets all the votes on a message
   * TODO: doesnt handle unlikes and duplicates yet.
   * @param {string} msgId - id of a message
   */
  const getVotes = (msgId) => {
    return new Promise((resolve, reject) => {
      pull(
        ssb.db.query(
          where(
            votesFor(msgId)
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
   * Gets all the threads initiated by a certain feed id
   * @param {string} feedId - feedId of a user
   * @param {object} opts - optional parameters
   * @param {int} [opts.limit=10] - max amount of threads to return
   * @param {int} opts.threadMaxSize - max amount of messages in each thread to return
   */
  const getThreads = (feedId, opts) => {
    const { threadMaxSize, limit = 10 } = opts
    return new Promise((resolve, reject) => {
      pull(
        ssb.threads.profile({ id: feedId, reverse: true, threadMaxSize, allowlist: ['post'] }),
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
                  text: msg.value.content.text,
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

  const getAlias = (alias) => {
    return new Promise((resolve, reject) => {
      fetch(ROOM_URL + '/alias' + `/${alias}` + '?encoding=json')
        .then(res => res.json())
        .then(res => {
          if (res.error) return resolve(null)

          resolve(res.data)
        })
    })
  }

  return {
    Query: {
      getProfile: (_, opts) => getProfile(opts.id),
      getProfiles: (_, opts) => getProfiles(opts),

      getProfileByAlias: async (_, opts) => { // opts = { alias }
        const alias = await getAlias(opts.alias)
        if (!alias) return
  
        const profile = await p(getProfile)(alias?.userId)
        profile.alias = alias // this gets passed down to child resolvers Profile.ssbUri
        
        return profile
      }
    },

    Profile: {
      image: (parent) => {
        if (!parent.image) return
        return toSSBUri(parent.image, { port: BLOB_PORT })
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
      },
      // TODO: we need to be able to get alias by feedId in order for this to work
      // for profiles that use the getProfile resolver
      // this will only work for profiles found using the getProfileByAlias resolver
      ssbURI: (parent) => {
        const alias = parent.alias
        if (!alias) return
      
        const url = new URL('ssb:experimental')
        const searchParams = url.searchParams
      
        searchParams.set('action', 'consume-alias')
        searchParams.set('roomId', alias.roomId)
        searchParams.set('alias', alias.alias)
        searchParams.set('userId', alias.author)
        searchParams.set('signature', alias.signature)
        searchParams.set('multiserverAddress', alias.multiserverAddress)

        return url.href
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
