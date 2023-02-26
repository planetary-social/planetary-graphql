const test = require('tape')
const { promisify: p } = require('util')
const gql = require('graphql-tag')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile, GetThreads, sleep } = require('../lib/helpers')

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
      }
    }
  }
}
`

const PostMessage = (ssb) => {
  return async function postMessage (content = {}, user) {
    const res = await p(ssb.db.create)({
      content: {
        type: 'post',
        ...content
      },
      keys: user.keys
    })

    // hack: we need this here because messages
    // post too quickly, resulting in threads being out of order
    await sleep(500)

    return res.key
  }
}

test('threads', async t => {
  t.plan(2)
  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)
  const getProfile = GetProfile(apollo, t, GET_PROFILE)
  const postMessage = PostMessage(ssb)

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

test('paginate threads by user', async t => {
  t.plan(13)

  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)
  const postMessage = PostMessage(ssb)
  const getThreads = GetThreads(apollo, t)

  // setup some test users
  const alice = await createUser('alice', { publicWebHosting: true })
  const bob = await createUser('bob', { publicWebHosting: true })
  const carol = await createUser('carol', { publicWebHosting: false }) // publicWebHosting=false

  // alice starts a thread
  const msgId1 = await postMessage({
    text: 'Say hi!'
  }, alice)

  // bob replies
  await postMessage({
    text: 'Kia ora!',
    root: msgId1
  }, bob)

  // so does someone who has opted out of public web hosting
  await postMessage({
    text: 'Bonjour!',
    root: msgId1
  }, carol)

  // alice posts a couple more messages
  const msgId4 = await postMessage({
    text: 'Today is sunny'
  }, alice)

  const msgId5 = await postMessage({
    text: 'Boop!'
  }, alice)

  // get all the threads by alice
  let threads = await getThreads({ feedId: alice.id })

  t.deepEqual(
    threads.map(thread => thread.id).sort(),
    [
      msgId5,
      msgId4,
      msgId1
    ].sort(),
    'returns correct thread root message keys'
  )

  // paginate threads
  threads = await getThreads({ feedId: alice.id, limit: 1 })
  t.equal(threads.length, 1, 'returns only one thread')
  let lastThread = threads.pop()
  t.equal(lastThread.id, msgId5, 'returns the latest thread first')

  // paginate the next thread
  threads = await getThreads({ feedId: alice.id, limit: 1, cursor: lastThread.id })
  t.equal(threads.length, 1, 'returns only one thread')
  lastThread = threads.pop()
  t.equal(lastThread.id, msgId4, 'second message returned is the 4th message posted')

  // should get the first message because the 2nd and 3rd were
  // comments of the first
  threads = await getThreads({ feedId: alice.id, limit: 1, cursor: lastThread.id })
  t.equal(threads.length, 1, 'returns only one thread')
  lastThread = threads.pop()
  t.equal(lastThread.id, msgId1, 'third message returned is the 1st message posted')

  threads = await getThreads({ feedId: alice.id, limit: 1, cursor: lastThread.id })
  t.deepEqual(threads, [], 'no more threads')

  ssb.close()
})

// this test is similar to the one above, but
// instead of from a single user, it looks at threads from
// all of the members
test('paginate threads by members', async t => {
  t.plan(13)

  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)
  const postMessage = PostMessage(ssb)

  // setup some test users
  const alice = await createUser('alice', { publicWebHosting: true })
  const bob = await createUser('bob', { publicWebHosting: true })
  const carol = await createUser('carol', { publicWebHosting: false }) // publicWebHosting=false

  // the server needs to follow each member
  const follow = async (id) => {
    await p(ssb.db.publish)({
      type: 'contact',
      contact: id,
      following: true
    })

    return sleep(200)
  }

  await follow(alice.id)
  await follow(bob.id)
  await follow(carol.id)

  // hack to set the room members
  ssb.room = {
    members: () => [alice.id, bob.id, carol.id]
  }

  const getThreads = GetThreads(apollo, t)

  // alice starts a thread
  const msgId1 = await postMessage({
    text: 'Say hi!'
  }, alice)

  // bob replies
  await postMessage({
    text: 'Kia ora!',
    root: msgId1
  }, bob)

  // so does someone who has opted out of public web hosting
  await postMessage({
    text: 'Bonjour!',
    root: msgId1
  }, carol)

  // alice posts a couple more messages
  const msgId4 = await postMessage({
    text: 'Today is sunny'
  }, alice)

  const msgId5 = await postMessage({
    text: 'Boop!'
  }, alice)

  // get all the threads
  let threads = await getThreads()

  t.deepEqual(
    threads.map(thread => thread.id).sort(),
    [
      msgId5,
      msgId4,
      msgId1
    ].sort(),
    'returns correct thread root message keys'
  )

  // paginate threads
  threads = await getThreads({ limit: 1 })
  t.equal(threads.length, 1, 'returns only one thread')
  let lastThread = threads.pop()
  t.equal(lastThread.id, msgId5, 'returns the latest thread first')

  // paginate the next thread
  threads = await getThreads({ limit: 1, cursor: lastThread.id })
  t.equal(threads.length, 1, 'returns only one thread')
  lastThread = threads.pop()
  t.equal(lastThread.id, msgId4, 'second message returned is the 4th message posted')

  // should get the first message because the 2nd and 3rd were
  // comments of the first
  threads = await getThreads({ limit: 1, cursor: lastThread.id })
  t.equal(threads.length, 1, 'returns only one thread')
  lastThread = threads.pop()
  t.equal(lastThread.id, msgId1, 'third message returned is the 1st message posted')

  threads = await getThreads({ limit: 1, cursor: lastThread.id })
  t.deepEqual(threads, [], 'no more threads')

  ssb.close()
})
