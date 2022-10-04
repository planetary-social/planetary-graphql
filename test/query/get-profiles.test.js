const test = require('tape')
const gql = require('graphql-tag')
const ssbKeys = require('ssb-keys')
const { promisify: p } = require('util')

const TestBot = require('../test-bot')
const { carol } = require('../lib/test-users')

const SORT = (a, b) => a.id - b.id

test('getProfiles', async t => {
  t.plan(7)
  const { apollo, ssb } = await TestBot()

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
    res.data.getProfiles.sort(SORT),
    [
      {
        id: carol.id,
        name: carol.name
      }
    ].sort(SORT),
    'returns only carol in getProfiles'
  )

  // save another couple of people
  const createProfile = (user) => {
    return p(ssb.db.create)({
      content: {
        type: 'about',
        about: user.id,
        name: user.name,
        publicWebHosting: user.publicWebHosting
      },
      keys: user.keys
    })
  }

  const cherese = ssbKeys.generate()
  await createProfile({
    id: cherese.id,
    name: 'cherese',
    publicWebHosting: true,
    keys: cherese
  })

  const mix = ssbKeys.generate()
  await createProfile({
    id: mix.id,
    name: 'mix',
    publicWebHosting: true,
    keys: mix
  })

  res = await getProfiles()
  t.error(res.errors, 'gets profiles without error')

  t.deepEqual(
    res.data.getProfiles.sort(SORT),
    [
      {
        id: mix.id,
        name: 'mix'
      },
      {
        id: cherese.id,
        name: 'cherese'
      },
      {
        id: carol.id,
        name: carol.name
      }
    ].sort(SORT),
    'returns all the correct profiles'
  )

  // limit
  res = await getProfiles(2)
  t.error(res.errors, 'gets profiles (with limit) without error')

  t.equals(res.data.getProfiles.length, 2, 'returns the correct amount of profiles when the limit is set')

  t.deepEqual(
    res.data.getProfiles.sort(SORT),
    [
      {
        id: mix.id,
        name: 'mix'
      },
      {
        id: cherese.id,
        name: 'cherese'
      }
    ].sort(SORT),
    'returns the correct profiles when the limit is set'
  )

  ssb.close()
})
