const test = require('tape')
const { promisify: p } = require('util')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('followers', async t => {
  t.plan(11)
  const { apollo, ssb } = await TestBot()
  const createUser = CreateUser(ssb)
  const getProfile = GetProfile(apollo, t)

  // init users
  const alice = await createUser('alice', true)
  let profile = await getProfile(alice.id)

  t.deepEqual(
    profile,
    {
      id: alice.id,
      name: alice.name,
      image: null,
      followersCount: 0,
      followers: [],

      followingCount: 0,
      following: []
    },
    'alice has no followers to begin with'
  )

  // a new user named bob (publicWebHosting=true)
  const bob = await createUser('bob', true)

  // bob follows alice
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: alice.id,
      following: true
    },
    keys: bob.keys
  })

  // get alices profile again
  profile = await getProfile(alice.id)

  t.equals(profile.followersCount, 1, 'alice has 1 follower')

  t.deepEqual(
    profile.followers,
    [
      {
        id: bob.id,
        name: bob.name
      }
    ],
    'alice has one follower = bob'
  )

  // a new user named carol (publicWebHosting=false)
  const carol = await createUser('carol', false)

  // carol follows alice
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: alice.id,
      following: true
    },
    keys: carol.keys
  })

  // get alices profile again
  profile = await getProfile(alice.id)

  t.equals(profile.followersCount, 2, 'alice has 2 followers')

  t.deepEqual(
    profile.followers,
    [
      {
        id: bob.id,
        name: bob.name
      }
    ],
    'only bobs profile is returned' // because carol has publicWebHosting=false
  )

  // bob unfollows alice
  await p(ssb.db.create)({
    content: {
      type: 'contact',
      contact: alice.id,
      following: false
    },
    keys: bob.keys
  })

  profile = await getProfile(alice.id)

  t.equals(profile.followersCount, 1, 'alice still has 1 follower')
  t.equals(profile.followers.length, 0, 'doesnt return any followers profiles')

  ssb.close()
})
