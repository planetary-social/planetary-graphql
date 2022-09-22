const test = require('tape')

const Server = require('../..')
const Client = require('../client') // apollo

test('get-profile', async t => {
  const server = await Server()

  const client = Client() // TODO

  // publicWebHosting = true
  const mixDesktopId = '@DIoOBMaI1f0mJg+5tUzZ7vgzCeeHh8+zGta4pOjc+k0=.ed25519'


  // TODO : check playground

  const res = await client.query({
    query: gql`query ($id: String!) {
      getProfile (id: $id) {
        name
        description
      }
    }`,
    variables: { id: mixDesktopId }
  })

  console.log(JSON.stringify(res.data.getProfile, null, 2))

  t.deepEqual(res.data.getProfile, {
    name: '',
    description: ''
  })

  // has publicWebHosting = undefined
  const someId = '...' //

  server.close()
  t.end()
})
