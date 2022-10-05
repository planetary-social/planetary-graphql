const test = require('tape')
const { promisify: p } = require('util')
const gql = require('graphql-tag')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('threads', async t => {
  t.plan(2)
  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)

  const GET_PROFILE = gql`
    query getProfile ($id: ID!) {
      getProfile (id: $id) {
        id
        threads {
          id
          messages {
            id
            text
            author {
              id
            }
            # votes: [Vote]
            # votesCount: Int
            # replies: [Comment]
          }
        }
      }
    }
  `

  const getProfile = GetProfile(apollo, t, GET_PROFILE)

  // setup some test users
  const alice = await createUser('alice', true)
  const bob = await createUser('bob', true)
  const carol = await createUser('carol', false) // publicWebHosting=false

  async function postMessage (content = {}, user) {
    const res = await p(ssb.db.create)({
      content: {
        type: 'post',
        ...content
      },
      keys: user.keys
    })

    return res.key
  }

  // alice starts a thread
  const msgId = await postMessage({
    text: 'Say hi!'
  }, alice)

  // bob replies
  const msgId2 = await postMessage({
    text: 'Kia ora!',
    root: msgId
  }, bob)

  // so does someone who has opted out of public web hosting
  /* const msgId3 = */await postMessage({
    text: 'Bonjour!',
    root: msgId
  }, carol)

  // get the threads
  const profile = await getProfile(alice.id)

  t.deepEquals(
    profile,
    {
      id: alice.id,
      threads: [
        {
          id: msgId,
          messages: [
            {
              id: msgId,
              author: { id: alice.id },
              text: 'Say hi!'
            },
            {
              id: msgId2,
              author: { id: bob.id },
              text: 'Kia ora!'
            },
            { // publicWebHosting for this author is false
              // meaning it returns an empty message instead
              id: null,
              author: null,
              text: null
            }
          ]
        }
      ]
    },
    'returns the correct threads in the message'
  )

  ssb.close()
})
