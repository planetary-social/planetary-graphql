const test = require('tape')
const gql = require('graphql-tag')
const { createTestClient } = require('apollo-server-integration-testing')

const GraphqlServer = require('../../')

test('get-profile', async t => {
  t.plan(5)
  const apolloServer = await GraphqlServer()
  const client = createTestClient({ apolloServer })

  const GET_PROFILE = gql`
    query getProfile ($id: ID!) {
      getProfile (id: $id) {
        id
        name
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

  let res = await getProfile(mixDesktopId)

  t.error(res.errors, 'no errors')
  t.true(res.data.getProfile, 'returns a profile')

  t.deepEqual(
    res.data.getProfile,
    {
      id: mixDesktopId,
      name: 'mix.desktop'
    },
    'returns correct profile details'
  )

  // has publicWebHosting = undefined
  // TODO: seems to not be returning anything for my profile
  // const chereseId = '@oqZU8oiy6zdqFhOyN9EPXZJYtRbnG/L8zs3aYu0jh7E=.ed25519' // patchwork
  const chereseId = '@H2WuEI1viXlArfBrK4YvpfEabrs9ARhy5agnx25A9Lg=.ed25519' // planetary

  res = await getProfile(chereseId)
  t.error(res.errors, 'no errors')
  t.false(res.data.getProfile, 'doesnt return a profile')

  apolloServer.stop()
})
