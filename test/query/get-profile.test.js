const { Server } = require('http')
const test = require('tape')
const TestBot = require('../test-bot')

test('get-profile', async t => {
  const { ssb, apollo } = await TestBot()

  ssb.close()
  t.end()
})