module.exports = function Resolvers () {
  return {
    Query: {
      getProfile: (_, opts) => {}
    },

    Profile: {
      threads: (parent) => {
      },
      followers: (parent) => {
      },
      following: (parent) => {
      }
    },

    Thread: {
      root: (parent) => {
      },
      replies: (parent) => {
      }
    },

    Comment: {
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
