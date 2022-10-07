const test = require('tape')
const { promisify: p } = require('util')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('following', async t => {
  t.plan(11)
  const { apollo, ssb } = await TestBot()
  const createUser = CreateUser(ssb)
  const getProfile = GetProfile(apollo, t)

  // init users
  const alice = await createUser('alice', { publicWebHosting: true })
  let profile = await getProfile(alice.id)

  t.deepEqual(
    profile,
    {
      id: alice.id,
      name: alice.name,
      image: null,
      followingCount: 0,
      following: [],

      followersCount: 0,
      followers: []
    },
    'alice isnt following anyone to begin with'
  )

  // a new user named bob (publicWebHosting=true)
  const bob = await createUser('bob', { publicWebHosting: true })

  // alice follows bob
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: bob.id,
      following: true
    },
    keys: alice.keys
  })

  // get alices profile again
  profile = await getProfile(alice.id)

  t.equals(profile.followingCount, 1, 'alice is following 1 person')

  t.deepEqual(
    profile.following,
    [
      {
        id: bob.id,
        name: bob.name
      }
    ],
    'alice is following bob'
  )

  // a new user named carol (publicWebHosting=false)
  const carol = await createUser('carol', { publicWebHosting: false })

  // alice follows carol
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: carol.id,
      following: true
    },
    keys: alice.keys
  })

  // get alices profile again
  profile = await getProfile(alice.id)

  t.equals(profile.followingCount, 2, 'alice is following 2 people')

  t.deepEqual(
    profile.following,
    [
      {
        id: bob.id,
        name: bob.name
      }
    ],
    'only bobs profile is returned'
  )

  // alice unfollows bob
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: bob.id,
      following: false
    },
    keys: alice.keys
  })

  profile = await getProfile(alice.id)

  t.equals(profile.followingCount, 1, 'alice is still following 1 person')
  t.equals(profile.following.length, 0, 'doesnt return any following profiles')

  ssb.close()
})
