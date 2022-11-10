const fetch = require('node-fetch')
const pull = require('pull-stream')
const pullParaMap = require('pull-paramap')
const pullFlatMap = require('pull-flatmap')
const { where, type, descending, toPullStream, votesFor } = require('ssb-db2/operators')
const { promisify: p } = require('util')
const toSSBUri = require('../../lib/to-ssb-uri')

const ROOM_URL = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
  ? 'https://civic.love'
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

  const roomState = {
    name: null,
    members: new Map()
  }

  if (process.env.ROOM_ADDRESS) {
    function updateRoomData () {
      ssb.conn.connect(process.env.ROOM_ADDRESS, (err, rpc) => {
        if (err) return console.error('failed to connect to room', err)

        rpc.room.metadata((err, data) => {
          if (err) return console.error(err)
          roomState.name = data.name

          pull(
            rpc.room.members({}),
            pullFlatMap(arr => arr),
            pullParaMap((member, cb) => {
              rpc.room.listAliases(member.id)
                .then((aliases) => cb(null, { ...member, aliases }))
            }, 5),
            pull.drain(
              member => roomState.members.set(member.id, member),
              err => {
                if (err) console.error('rpc.room.members error', err)
                rpc.close((err) => {
                  if (err) console.error('rpc.close error', err)
                })
              }
            )
          )
        })
      })
    }

    updateRoomData()
    const MINUTE = 60 * 1000
    setInterval(updateRoomData, 5 * MINUTE)
  }

  const getAliasInfo = (alias) => {
    return new Promise((resolve, reject) => {
      fetch(ROOM_URL + '/alias' + `/${alias}` + '?encoding=json')
        .then(res => res.json())
        .then(res => {
          if (res.error) return resolve(null)

          resolve(res)
        })
    })
  }

  return {
    Query: {
      getMyRoom () {
        if (!process.env.ROOM_ADDRESS) return null

        return {
          multiaddress: process.env.ROOM_ADDRESS,
          name: roomState.name,
          members: Array.from(roomState.members.keys())
        }
      },
      getProfile: (_, opts) => getProfile(opts.id),
      getProfiles: (_, opts) => getProfiles(opts),

      getProfileByAlias: async (_, opts) => { // opts = { alias }
        const alias = await getAliasInfo(opts.alias)
        if (!alias) return

        return getProfile(alias.userId)
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
      ssbURI: async (parent) => {
        const member = roomState.members.get(parent.id)
        if (!member) return

        // get their alias
        const alias = member.aliases?.length && member.aliases[0]
        if (!alias) return

        const aliasInfo = await getAliasInfo(alias)
        if (!aliasInfo) return

        const url = new URL('ssb:experimental')
        const searchParams = url.searchParams

        searchParams.set('action', 'consume-alias')
        searchParams.set('roomId', aliasInfo.roomId)
        searchParams.set('alias', aliasInfo.alias)
        searchParams.set('userId', parent.id)
        searchParams.set('signature', aliasInfo.signature)
        searchParams.set('multiserverAddress', aliasInfo.multiserverAddress)

        return url.href
      },
      aliases: (parent) => {
        const member = roomState.members.get(parent.id)
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
      members: async (parent) => getProfilesForIds(parent.members)
    }
  }
}
