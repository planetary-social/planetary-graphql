const fetch = require('node-fetch')
const pull = require('pull-stream')
const pullParaMap = require('pull-paramap')
const { where, type, descending, toPullStream, votesFor } = require('ssb-db2/operators')
const { promisify: p } = require('util')

const toBlobUri = require('../lib/to-blob-uri')

// TODO: could probably be moved into an environment variable
const DEFAULT_LANGUAGE_CODE = 'en-GB'
const ROOM_URL = process.env.ROOM_URL

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
  const canPubliclyHost = (feedId) => getProfile(feedId).then(Boolean)

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
            .catch(cb)
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
   * Gets all the public threads that room members have posted or replied to
   * @param {object} opts - optional parameters
   * @param {int} [opts.limit=10] - max amount of threads to return
   * @param {int} opts.threadMaxSize - max amount of messages in each thread to return
   */
  const getPublicThreads = (opts) => {
    const { threadMaxSize, limit = 10 } = opts
    const members = ssb.room.members()
  
    return new Promise((resolve, reject) => {
      pull(
        ssb.threads.public({ threadMaxSize, allowlist: ['post'], following: true }),
        // hacky! Only threads that contain a message from a member of the room
        // this is because the room is following some users who are not members
        pull.filter(thread => {
          return thread.messages.some(message => {
            return members.includes(message.value?.author)
          })
        }),
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
   * Takes a messages and maps it either to a Comment or "empty" Comment depending on
   * whether the author has opted into publicWebHosting.
   * @param {object} msg - a post message in kv format
   * @param {function} cb - an error first callback function
   */
  function publicifyMessage (msg, cb) {
    const message = {
      id: null,
      author: null,
      timestamp: msg.value.timestamp, // asserted publish time
      text: null
    }

    canPubliclyHost(msg.value.author)
      .then(canHost => {
        // if there was a profile, that means publicWebHosting === true
        if (canHost) {
          message.id = msg.key
          message.author = msg.value.author
          message.text = msg.value.content.text
        }

        cb(null, message)
      })
      .catch(_err => cb(null, message))
  }

  const getAliasInfo = (alias) => {
    // TODO use ssb.room state first
    return fetch(ROOM_URL + '/alias' + `/${alias}` + '?encoding=json')
      .then(res => res.json())
      .then(res => res.error ? null : res)
  }

  function getRoomInviteCode () {
    const url = ROOM_URL + '/create-invite'
    return fetch(url,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )
      .then(res => res.json())
      .then(res => res.error ? null : res.url)
  }

  return {
    Query: {
      getMyRoom (_, opts) {
        if (!ssb.room.address()) return null

        return {
          multiaddress: ssb.room.address(),
          id: process.env.ROOM_KEY,
          name: ssb.room.name(),
          members: ssb.room.members(),
          notices: ssb.room.notices(),
          language: opts.language || DEFAULT_LANGUAGE_CODE
        }
      },
      getProfile: (_, opts) => getProfile(opts.id),
      getProfiles: (_, opts) => getProfiles(opts),

      getProfileByAlias: async (_, opts) => { // opts = { alias }
        const alias = await getAliasInfo(opts.alias)
        if (!alias) return

        return getProfile(alias.userId)
      },
      getInviteCode: () => getRoomInviteCode(),

      getThreads: (_, opts = {}) => {
        return opts.id
          ? getThreads(opts.id, opts)
          : getPublicThreads(opts)
      }
    },
    Profile: {
      image: (parent) => {
        if (!parent.image) return
        return toBlobUri(parent.image, { port: BLOB_PORT })
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
      ssbURI: async (parent) => {
        const url = new URL('ssb:experimental')
        const searchParams = url.searchParams

        searchParams.set('action', 'consume-alias')
        searchParams.set('roomId', process.env.ROOM_KEY)
        searchParams.set('userId', parent.id)
        searchParams.set('multiserverAddress', ssb.room.address())

        // see if we can find an alias
        const member = ssb.room.member(parent.id)
        if (!member) return url.href

        const alias = member.aliases?.length && member.aliases[0]
        if (!alias) return url.href

        const aliasInfo = await getAliasInfo(alias)
        if (!aliasInfo) return url.href

        searchParams.set('alias', aliasInfo.alias)
        searchParams.set('signature', aliasInfo.signature)

        return url.href
      },
      aliases: (parent) => {
        const member = ssb.room.member(parent.id)
        return member?.aliases
      }
    },

    Thread: {
      messages: (parent) => new Promise((resolve, reject) => {
        pull(
          pull.values(parent.messages),
          pullParaMap(publicifyMessage, 5),
          pull.collect((err, res) => err ? reject(err) : resolve(res))
        )
      })
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
    },

    Room: {
      url: () => ROOM_URL,
      members: async (parent) => getProfilesForIds(parent.members),
      description: (parent) => {
        const notices = Object.values(parent.notices)
          .flatMap(arr => arr)
          ?.find(notice => notice.name === 'NoticeDescription')
          ?.notices

        return notices
          ?.find(notice => notice.language === parent.language)
          ?.content
      }
      // TODO: other notices include:
      // - [ ] NoticeCodeOfConduct
      // - [ ] NoticeNews
      // - [ ] NoticePrivaryPolicy
    }
  }
}
