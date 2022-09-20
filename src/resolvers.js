const ssbResolvers = require('./ssb')

module.exports = function Resolvers (sbot) {
  const {
    getPost,
    getFeed,
    getCounts,
    getProfile,
    gettersWithCache
  } = ssbResolvers(sbot)

  const resolvers = {
    Query: {

      getPost: (_, { key }) => getPost(key),
      // - [ ] get a message, give a message key
      // - [ ] get a thread of messages, given a message key
      // getThread: (_, { key }) => getThread(key), // This looks the same as getPost

      getFeed: (_, opts) => getFeed(opts),
      // - [ ] get a feed of messages, given a feedId
      // - [ ] get a feed of messages, given a username
      // - [ ] get a default feed of messages
      // - [ ] get feed of messages, by page

      getCounts: (_, opts) => getCounts(opts),
      // - [ ] get counts of: followers, follows, posts, given a feedId
      // - [ ] get counts of: follower, follows, posts given a username

      getProfile: (_, opts) => getProfile(opts)
      // - [ ] get a profile by username
      // - [ ] get a profile by feedId

      // TODO
      // getProfiles: () => getProfiles()
    },
    Mutation: {
      // savePost: (_, { input }) => savePost(input)
    }
  }

  return {
    resolvers,
    gettersWithCache
  }
}
