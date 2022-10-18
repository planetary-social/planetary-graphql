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

    return {
      id: keys.id,
      name,
      ...aboutOpts,
      keys
    }
  }
}

function PostMessage (ssb) {
  return async function postMessage (content = {}, user) {
    const res = await p(ssb.db.create)({
      content: {
        type: 'post',
        ...content
      },
      keys: user.keys
    })

    return res.key
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

module.exports = {
  CreateUser,
  GetProfile,
  PostMessage
}
