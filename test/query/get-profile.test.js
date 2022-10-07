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
  const carol = await createUser('carol', { publicWebHosting: true }) // publicWebHosting=true

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
      image: null,
      following: [],
      followingCount: 0,
      followers: [],
      followersCount: 0
    },
    'returns profile for carol who has publicWebHosting enabled'
  )

  ssb.close()
})
