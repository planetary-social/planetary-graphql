const pull = require('pull-stream')
const SSB = require('./ssb-server')

const ssb = SSB({
  ebt: {
    // logging: true
  }
})

pull(
  ssb.conn.peers(),
  pull.map(updates => updates.map(update => [update[0], update[1].state])),
  pull.log()
)

pull(
  pull.infinite(),
  pull.through(() => console.log(ssb.db.getStatus().value)),
  pull.asyncMap((_, cb) => setTimeout(cb, 5000)),
  pull.drain()
)

ssb.db.onMsgAdded(ev => {
  if (ev.kvt.value.author === ssb.id) {
    console.log(JSON.stringify(ev.kvt.value.content, null, 2))
  }
})
