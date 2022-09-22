const pull = require('pull-stream')
const SSB = require('./ssb-server')

const ssb = SSB()

pull(
  ssb.conn.peers(),
  pull.log()
)

pull(
  pull.infinite(),
  pull.through(() => console.log(ssb.db.getStatus().value)),
  pull.asyncMap((_, cb) => setTimeout(cb, 5000)),
  pull.drain()
)
