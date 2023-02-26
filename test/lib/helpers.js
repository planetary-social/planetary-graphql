const ssbKeys = require('ssb-keys')
const { promisify: p } = require('util')
const gql = require('graphql-tag')

function CreateUser (ssb) {
  return async function createUser (name, aboutOpts = {}) {
    const keys = ssbKeys.generate()

    const content = {
      type: 'about',
      about: keys.id,
      name,
      ...aboutOpts
    }

    // publish the users about message
    await p(ssb.db.create)({ content, keys })
    await sleep(200)

    return {
      id: keys.id,
      name,
      ...aboutOpts,
      keys
    }
  }
}

const GET_PROFILE = gql`
query getProfile ($id: ID!) {
  getProfile (id: $id) {
    id
    name
    image
    followingCount
    following {
      id
      name
    }
    followersCount
    followers {
      id
      name
    }
  }
}
`

function GetProfile (apollo, t, QUERY) {
  return async function getProfile (id) {
    const res = await apollo.query(
      QUERY || GET_PROFILE,
      { variables: { id } }
    )

    t.error(res.errors, `gets profile ${id} without error`)
    if (res.errors) console.log(res.errors)

    return res.data.getProfile
  }
}

const GET_THREADS = gql`
  query($feedId: ID, $cursor: String, $limit: Int) {
    getThreads(feedId: $feedId, limit: $limit, cursor: $cursor) {
      id
      messages {
        id
        text
        author {
          id
        }
      }
    }
  }
`

function GetThreads (apollo, t) {
  return async function getThreads (opts = { limit: 10 }) {
    const res = await apollo.query(
      GET_THREADS,
      {
        variables: {
          ...opts
        }
      }
    )

    t.error(res.errors, 'gets threads without error')
    if (res.errors) console.log(JSON.stringify(res.errors, null, 2))

    return res.data.getThreads
  }
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

module.exports = {
  CreateUser,
  GetProfile,
  GetThreads,
  sleep
}
