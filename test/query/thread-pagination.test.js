const gql = require('graphql-tag')
const { promisify: p } = require('util')
const test = require('tape')
const series = require('run-series')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('threads pagination', async t => {
  t.plan(8)
  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)

  const GET_PROFILE = (limit, after = '') => (
    gql`
      query getProfile ($id: ID!) {
        getProfile (id: $id) {
          id
          feed (limit: ${limit}, after: "${after}") {
            threadsCount
            threads {
              id
              messages {
                id
                text
                author {
                  id
                }
              }
            }
          }
        }
      }
    `
  )

  // setup some test users
  const alice = await createUser('alice', { publicWebHosting: true })

  // generate 20 threads published by alice
  const testThreads = await p(series)(
    Array.from({ length: 19 })
      .map((_, i) => {
        return (cb) => {
          ssb.db.create({
            content: {
              type: 'post',
              text: 'test post ' + (i + 1)
            },
            keys: alice.keys
          }, (err, msg) => {
            if (err) return cb(err)

            // NOTE: this makes it so the messages
            // arent saved too quickly. Otherwise they can end
            // up with the same timestamp, which messes up the order
            setTimeout(() => {
              // return the same format as a thread
              cb(null, {
                id: msg.key,
                messages: [
                  {
                    id: msg.key,
                    text: msg.value.content.text,
                    author: {
                      id: alice.id
                    }
                  }
                ]
              })
            }, 50)
          })
        }
      })
  )

  const orderedThreads = testThreads.reverse()

  // get the threads
  let profile = await GetProfile(apollo, t, GET_PROFILE(5))(alice.id)
  let chunk = orderedThreads.slice(0, 5)

  t.deepEquals(
    profile,
    {
      id: alice.id,
      feed: {
        threadsCount: 19,
        threads: chunk
      }
    },
    'first call gets the first 5 threads'
  )

  let lastThreadId = chunk[4].id
  profile = await GetProfile(apollo, t, GET_PROFILE(5, lastThreadId))(alice.id)
  chunk = orderedThreads.slice(5, 10)

  t.deepEquals(
    profile.feed.threads,
    chunk,
    'second call gets the next 5 threads'
  )

  lastThreadId = chunk[4].id
  profile = await GetProfile(apollo, t, GET_PROFILE(5, lastThreadId))(alice.id)
  chunk = orderedThreads.slice(10, 15)

  t.deepEquals(
    profile.feed.threads,
    chunk,
    'third call gets the next 5 threads'
  )

  lastThreadId = chunk[4].id
  profile = await GetProfile(apollo, t, GET_PROFILE(5, lastThreadId))(alice.id)
  chunk = orderedThreads.slice(15, 19)

  t.deepEquals(
    profile.feed.threads,
    chunk,
    'last call gets the next 5 threads'
  )

  ssb.close()
})
