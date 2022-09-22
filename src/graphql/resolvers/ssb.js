const { promisify: p } = require('util')
const SSB = require('../../ssb-server')

module.exports = function Resolvers () {
  const ssb = SSB()

  return {
    ssb,
    resolvers: {
      Query: {
        getProfile: async (_, opts) => {
          const profile = await p(ssb.aboutSelf.get)(opts.id)

          if (!profile) return null
          if (profile.publicWebHosting !== true) return null
          
          return profile
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
}
