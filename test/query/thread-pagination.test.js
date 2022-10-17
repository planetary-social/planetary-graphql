const gql = require('graphql-tag')
const { promisify: p } = require('util')
const test = require('tape')
const series = require('run-series')

const TestBot = require('../test-bot')
const { CreateUser, GetProfile } = require('../lib/helpers')

test('threads pagination', async t => {
  t.plan(2)
  const { ssb, apollo } = await TestBot()
  const createUser = CreateUser(ssb)

  const GET_PROFILE = (limit) => (
    gql`
      query getProfile ($id: ID!) {
        getProfile (id: $id) {
          id
          threads (limit: ${limit}) {
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
    `
  )

  // setup some test users
  const alice = await createUser('alice', { publicWebHosting: true })

  // generate 20 threads published by alice
  const testThreads = await p(series)(
    Array.from({ length: 20 })
      .map((_, i) => {
        return (cb) => {
          ssb.db.create({
            content: {
              type: 'post',
              text: 'test post ' + i
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

  // get the threads
  const profile = await GetProfile(apollo, t, GET_PROFILE(5))(alice.id)

  t.deepEquals(
    profile,
    {
      id: alice.id,
      threads: testThreads.slice(0, 5)
    },
    'returns the correct threads in the message'
  )

  ssb.close()
})
