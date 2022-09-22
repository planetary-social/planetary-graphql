const { promisify: p } = require('util')
const SSB = require('../../ssb-server')

module.exports = function Resolvers () {
  const ssb = SSB()

  return {
    Query: {
      getProfile: async (_, opts) => {
        const profile = await p(ssb.aboutSelf.get)(opts.id)
          .catch(err => console.warn(err))
        if (!profile) return {}
        if (profile.publicWebhosting !== true) return {}
      }
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
