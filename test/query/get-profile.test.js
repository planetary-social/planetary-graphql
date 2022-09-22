const test = require('tape')
const gql = require('graphql-tag')
const { createTestClient } = require('apollo-server-integration-testing')

const GraphqlServer = require('../../')

test('get-profile', async t => {
  const apolloServer = await GraphqlServer()
  const client = createTestClient({ apolloServer })

  // publicWebHosting = true
  const mixDesktopId = '@DIoOBMaI1f0mJg+5tUzZ7vgzCeeHh8+zGta4pOjc+k0=.ed25519'

  const GET_PROFILE = gql`query getProfile($id: ID!) {
    getProfile(id: $id) {
      id
      name
    }
  }`

  // TODO : check playground
  // NOTE: can also use server.executeOperation instead of client.query
  const res = await client.query({
    query: GET_PROFILE,
    variables: { id: mixDesktopId }
  })

  t.error(res.errors, 'no errors')
  t.true(res.data.getProfile, 'returns a profile')

  console.log(res.errors)
  console.log(JSON.stringify(res.data.getProfile, null, 2))

  t.deepEqual(res.data.getProfile, {
    id: mixDesktopId,
    name: '',
  })

  // has publicWebHosting = undefined
  const someId = '...' //

  server.close()
  t.end()
})
