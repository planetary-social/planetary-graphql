// const ssbResolvers = require('./ssb')

module.exports = function Resolvers (sbot) {
  // const {
  //   getProfile,
  //   gettersWithCache
  // } = ssbResolvers(sbot)

  function getProfile (opts) {
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

  const resolvers = {
    Query: {
      getProfile: (_, opts) => getProfile(opts)

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
