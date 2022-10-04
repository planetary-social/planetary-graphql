const test = require('tape')
const gql = require('graphql-tag')
// const { createTestClient } = require('apollo-server-integration-testing')
const ssbKeys = require('ssb-keys')
const { promisify: p } = require('util')
// const GraphqlServer = require('../../src/graphql')
const TestBot = require('../test-bot')

test('get-profile', async t => {
  t.plan(6)
  const { apollo, ssb } = await TestBot()

  // helpers

  const GET_PROFILE = gql`
    query getProfile ($id: ID!) {
      getProfile (id: $id) {
        id
        name
        image
      }
    }
  `

  function getProfile (id) {
    return apollo.query(
      GET_PROFILE,
      { variables: { id } }
    )
  }

  const createProfile = (profile) => {
    return p(ssb.db.create)(profile)
  }

  const alice = ssbKeys.generate()
  const bob = ssbKeys.generate()
  const carol = ssbKeys.generate()

  // create alices profile
  await createProfile({
    content: {
      type: 'about',
      about: alice.id,
      name: 'alice'
      // publicWebHosting: undefined
    },
    keys: alice
  })

  let res = await getProfile(alice.id)
  t.error(res.errors, 'get alices profile returns no errors')
  t.false(res.data.getProfile, 'returns no profile for alice')

  await createProfile({
    content: {
      type: 'about',
      about: bob.id,
      name: 'bob',
      publicWebHosting: false
    },
    keys: bob
  })

  res = await getProfile(bob.id)
  t.error(res.errors, 'get bobs profile returns no errors')
  t.false(res.data.getProfile, 'returns no profile for bob')

  await createProfile({
    content: {
      type: 'about',
      about: carol.id,
      name: 'carol',
      publicWebHosting: true
    },
    keys: carol
  })

  res = await getProfile(carol.id)
  t.error(res.errors, 'get carols profile returns no errors')
  t.deepEqual(
    res.data.getProfile,
    {
      id: carol.id,
      name: 'carol',
      image: null
    }
  )

  ssb.close()
})
