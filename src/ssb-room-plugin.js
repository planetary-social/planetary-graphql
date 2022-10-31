const pull = require('pull-stream')

/**
 * The sole purpose of this plugin is to declare the remote manifest,
 * nothing else.
 */
module.exports = {
  name: 'room',
  version: '1.0.0',
  manifest: {
    attendants: 'source',
    metadata: 'async'
    // registerAlias: 'async',
    // revokeAlias: 'async',
  },
  init () {
    return {
      attendants () {
        return pull.error(new Error('not implemented on the client'))
      },
      metadata (cb) {
        cb(new Error('not implemented on the client'))
      }

      // registerAlias (_alias, _sig, cb) {
      //   cb(new Error('not implemented on the client'))
      // },
      // revokeAlias (_alias, cb) {
      //   cb(new Error('not implemented on the client'))
      // }
    }
  }
}
