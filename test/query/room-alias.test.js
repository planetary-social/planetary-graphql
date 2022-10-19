const test = require('tape')
const { where, type, descending, toCallback } = require('ssb-db2/operators')
// const { promisify: p } = require('util')

const TestBot = require('../test-bot')

test.only('followers', async t => {
  t.plan(11)
  const { apollo, ssb } = await TestBot()
 
  ssb.db.query(
    where(
      type('room/alias')
    ),
    descending(), // latest => oldest
    toCallback((err, res) => {
      console.log(res)

      ssb.close()
    })
  )

})
