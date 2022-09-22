// const ssbResolvers = require('./ssb')
const { promisify: p } = require('util')

module.exports = function Resolvers (sbot) {
  // const {
  //   getProfile,
  //   gettersWithCache
  // } = ssbResolvers(sbot)

  function getProfileTest (opts) {
    return {
      id: opts.id,
      name: 'Cherese',
      image: '',
      // publicWebHosting

      threads: [],
      // threads (started: Boolean): [Thread]
      // threadCount: Int

      followers: [],
      followersCount: 0,

      following: [],
      followingCount: 0
    }
  }

  function getProfileDb2 (opts, cb) {
    const { feedId } = opts

    sbot.aboutSelf.get(feedId, (err, profile) => {
      if (profile.publicWebhosting !== true) cb(null, null)

      cb(null, profile)
    })
  }

  const resolvers = {
    Query: {
      getProfile: (_, opts) => p(getProfileDb2)(opts)

      // TODO
      // getThread(key: ID!, preview: Boolean): Thread
      // getSample(limit: Int): [Thread]
      // getProfiles(limit: Int) [Profile]
    }
    // Mutation: {
    // }
  }

  return {
    resolvers
    // gettersWithCache
  }
}
