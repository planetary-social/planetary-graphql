const test = require('tape')

const TestBot = require('../test-bot')
const { CreateUser, GetThread, PostMessage } = require('../lib/helpers')

test('thread', async t => {
  t.plan(8)
  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)
  // const getProfile = GetProfile(apollo, t, GET_PROFILE)
  const postMessage = PostMessage(ssb)
  const getThread = GetThread(apollo, t)

  // setup some test users
  const alice = await createUser('alice', { publicWebHosting: true })
  const bob = await createUser('bob', { publicWebHosting: true })
  const carol = await createUser('carol', { publicWebHosting: false }) // publicWebHosting=false

  // alice starts a thread
  const msgId = await postMessage({
    text: 'Say hi!'
  }, alice)

  // bob replies
  const msgId2 = await postMessage({
    text: 'Kia ora!',
    root: msgId
  }, bob)

  const msgId3 = await postMessage({
    text: 'Bonjour!',
    root: msgId
  }, carol)

  // alice responds to one of the comments
  const msgId4 = await postMessage({
    text: ':D',
    root: msgId2
  }, alice)

  // get the thread
  let thread = await getThread(msgId)

  t.true(thread.timestamp, 'a timestamp was returned')

  t.deepEquals(
    thread,
    {
      id: msgId,
      text: 'Say hi!',
      root: null,
      timestamp: thread.timestamp,
      author: {
        id: alice.id
      },
      replies: [
        {
          id: msgId2,
          author: { id: bob.id },
          text: 'Kia ora!',
          root: {
            id: msgId
          }
        },
        { // publicWebHosting for this author is false
          // meaning it returns an empty message instead
          id: null,
          author: null,
          text: null,
          root: {
            id: msgId
          }
        }
      ]
    },
    'returns the correct threads in the message'
  )

  thread = await getThread(msgId2)

  t.true(thread.timestamp, 'a timestamp was returned')

  t.deepEquals(
    thread,
    {
      id: msgId2,
      text: 'Kia ora!',
      timestamp: thread.timestamp,
      root: {
        id: msgId
      },
      author: {
        id: bob.id
      },
      replies: [
        {
          id: msgId4,
          text: ':D',
          author: {
            id: alice.id
          },
          root: {
            id: msgId2
          }
        }
      ]
    },
    'response returns the correct thread format'
  )

  /*
    public web hosting check!
  */

  // try get the thread from the user who has publicWebHosting=false
  thread = await getThread(msgId3)
  t.false(thread, 'does not return the thread for someone who has publicWebHosting=false')

  ssb.close()
})
