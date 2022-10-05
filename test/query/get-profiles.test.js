const test = require('tape')
const gql = require('graphql-tag')

const TestBot = require('../test-bot')
const { CreateUser } = require('../lib/helpers')

test('getProfiles', async t => {
  t.plan(7)
  const { apollo, ssb } = await TestBot()
  const createUser = CreateUser(ssb)

  const carol = await createUser('carol', true)

  // helpers
  const GET_PROFILES = gql`
    query getProfiles ($limit: Int) {
      getProfiles (limit: $limit) {
        id
        name
      }
    }
  `

  function getProfiles (limit) {
    return apollo.query(
      GET_PROFILES,
      { variables: { limit } }
    )
  }

  // no limit
  let res = await getProfiles()
  t.error(res.errors, 'gets profiles without error')

  t.deepEqual(
    res.data.getProfiles,
    [
      {
        id: carol.id,
        name: carol.name
      }
    ],
    'returns only carol in getProfiles'
  )

  // create some more users
  const dan = await createUser('dan', true)
  const mix = await createUser('mix', true)

  res = await getProfiles()
  t.error(res.errors, 'gets profiles without error')

  t.deepEqual(
    res.data.getProfiles,
    [
      {
        id: mix.id,
        name: mix.name
      },
      {
        id: dan.id,
        name: dan.name
      },
      {
        id: carol.id,
        name: carol.name
      }
    ],
    'returns all the correct profiles'
  )

  // limit
  res = await getProfiles(2)
  t.error(res.errors, 'gets profiles (with limit) without error')

  t.equals(res.data.getProfiles.length, 2, 'returns the correct amount of profiles when the limit is set')

  t.deepEqual(
    res.data.getProfiles,
    [
      {
        id: mix.id,
        name: 'mix'
      },
      {
        id: dan.id,
        name: dan.name
      }
    ],
    'returns the correct profiles when the limit is set'
  )

  ssb.close()
})
