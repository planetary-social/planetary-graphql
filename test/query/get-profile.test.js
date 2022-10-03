const test = require('tape')
const gql = require('graphql-tag')
const { createTestClient } = require('apollo-server-integration-testing')
const ssbKeys = require('ssb-keys')

const GraphqlServer = require('../../src/graphql')

test('get-profile', async t => {
  t.plan(4)
  const { ssb, apolloServer } = await GraphqlServer()
  const client = createTestClient({ apolloServer })

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
    return client.query(
      GET_PROFILE,
      { variables: { id } }
    )
  }

  // publicWebHosting = true
  const mixDesktopId = '@DIoOBMaI1f0mJg+5tUzZ7vgzCeeHh8+zGta4pOjc+k0=.ed25519'
  const res = await getProfile(mixDesktopId)

  t.error(res.errors, 'no errors')
  t.true(res.data.getProfile, 'returns a profile')

  // console.log(res)

  t.deepEqual(
    res.data.getProfile,
    {
      id: mixDesktopId,
      name: 'mix.desktop',
      image: 'http://localhost:26835/get/%26DxN64JjBNxEJUe2yjBpDW9eR9coxGhOQW6dYcU%2BK9%2FU%3D.sha256'
    },
    'returns correct profile details'
  )

  // has publicWebHosting = undefined
  // TODO: seems to not be returning anything for my profile
  // const chereseId = '@Z9Su0CwHlLBmS3W6CIva67B/9oiz24MVJCpMJ4lcDmE=.ed25519'

  // res = await getProfile(chereseId)
  // t.error(res.errors, 'no errors')
  // t.false(res.data.getProfile, 'doesnt return a profile')

  // ssb.close()
  // apolloServer.stop()

  const alice = ssbKeys.generate()

  ssb.db.publishAs(alice, {
    type: 'about',
    about: alice.id,
    name: 'alice',
    // publicWebHosting=undefined    
  }, (err, res) => {
    t.error(err)

    console.log(res)
    setTimeout(() => apolloServer.stop(), 3000)
  })
})
