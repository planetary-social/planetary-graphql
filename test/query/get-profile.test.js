const test = require('tape')
const gql = require('graphql-tag')

const TestBot = require('../test-bot')
const { alice, bob, carol } = require('../lib/test-users')

test('getProfile', async t => {
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

  // get a user who has publicWebHosting=undefined
  let res = await getProfile(alice.id)
  t.error(res.errors, 'get alices profile returns no errors')
  t.false(res.data.getProfile, 'returns no profile for alice')

  // get a user who has publicWebHosting=false
  res = await getProfile(bob.id)
  t.error(res.errors, 'get bobs profile returns no errors')
  t.false(res.data.getProfile, 'returns no profile for bob')

  // get a user who has publicWebHosting=true
  res = await getProfile(carol.id)
  t.error(res.errors, 'get carols profile returns no errors')
  t.deepEqual(
    res.data.getProfile,
    {
      id: carol.id,
      name: 'carol',
      image: null
    },
    'returns profile for carol who has publicWebHosting enabled'
  )

  ssb.close()
})
