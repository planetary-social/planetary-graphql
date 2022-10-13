const test = require('tape')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('getProfile', async t => {
  t.plan(6)
  const { apollo, ssb } = await TestBot()
  const createUser = CreateUser(ssb)
  const getProfile = GetProfile(apollo, t)

  // init users
  const alice = await createUser('alice') // publicWebHosting=undefined
  const bob = await createUser('bob', { publicWebHosting: false }) // publicWebHosting=false
  const carol = await createUser('carol', { publicWebHosting: true, image: '&Ho1XhW2dp4bNJLZrYkurZPxlUhqrknD/Uu/nDp+KnMg=.sha256' }) // publicWebHosting=true

  // get a user who has publicWebHosting=undefined
  let profile = await getProfile(alice.id)
  t.equal(profile, null, 'returns no profile for alice')

  // get a user who has publicWebHosting=false
  profile = await getProfile(bob.id)
  t.equal(profile, null, 'returns no profile for bob')

  // get a user who has publicWebHosting=true
  profile = await getProfile(carol.id)
  t.deepEqual(
    profile,
    {
      id: carol.id,
      name: 'carol',
      image: 'http://localhost:26835/get/%26Ho1XhW2dp4bNJLZrYkurZPxlUhqrknD%2FUu%2FnDp%2BKnMg%3D.sha256',
      following: [],
      followingCount: 0,
      followers: [],
      followersCount: 0
    },
    'returns profile for carol who has publicWebHosting enabled'
  )

  ssb.close()
})

test('getProfile (staging)', async t => {
  t.plan(2)
  process.env.NODE_ENV = 'staging'

  const { apollo, ssb } = await TestBot()
  const createUser = CreateUser(ssb)
  const getProfile = GetProfile(apollo, t)

  // init users
  const carol = await createUser('carol', { publicWebHosting: true, image: '&Ho1XhW2dp4bNJLZrYkurZPxlUhqrknD/Uu/nDp+KnMg=.sha256' }) // publicWebHosting=true

  // get a user who has publicWebHosting=true
  const profile = await getProfile(carol.id)
  t.deepEqual(
    profile,
    {
      id: carol.id,
      name: 'carol',
      image: `${process.env.BLOBS_URL}/%26Ho1XhW2dp4bNJLZrYkurZPxlUhqrknD%2FUu%2FnDp%2BKnMg%3D.sha256`,
      following: [],
      followingCount: 0,
      followers: [],
      followersCount: 0
    },
    'returns correct image URI'
  )

  ssb.close()
})
