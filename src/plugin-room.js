/**
 * This plugin serves two purposes:
 * 1. declare the remote manifest (required to make RPC calls!)
 * 2. provide local getters for known room state
 */

const fetch = require('node-fetch')
const pull = require('pull-stream')
const pullFlatMap = require('pull-flatmap')
const pullParaMap = require('pull-paramap')
const ref = require('ssb-ref')

const MINUTE = 60 * 1000

const dummyRemoteApi = {
  attendants: () => pull.error(new Error('not implemented on the client')),
  metadata (cb) { cb(new Error('not implemented on the client')) },
  members: () => pull.error(new Error('not implemented on the client')),
  listAliases (cb) { cb(new Error('not implemented on the client')) },
  registerAlias (_alias, _sig, cb) { cb(new Error('not implemented on the client')) },
  revokeAlias (_alias, cb) { cb(new Error('not implemented on the client')) }
}

module.exports = {
  name: 'room',
  version: '1.0.0',
  manifest: {
    attendants: 'source',
    metadata: 'async',
    members: 'source',
    listAliases: 'async',
    registerAlias: 'async',
    revokeAlias: 'async'
  },
  init (ssb) {
    if (!process.env.ROOM_HOST) throw new Error('missing env: ROOM_HOST')
    if (!process.env.ROOM_KEY) throw new Error('missing env: ROOM_KEY')

    const state = {
      address: buildMultiserverAddress(),
      name: null,
      notices: null,
      members: new Map()
    }

    const runUpdate = () => updateRoomData(ssb, state)

    runUpdate()
    setInterval(runUpdate, 5 * MINUTE)

    return {
      ...dummyRemoteApi,

      id: () => process.env.ROOM_KEY,
      address: () => state.address,
      name: () => state.name,
      notices: () => state.notices || {},
      members: () => Array.from(state.members.keys()),
      member: (id) => state.members.get(id)
      // getMemberByAlias // TODO
    }
  }
}

function updateRoomData (ssb, state) {
  /* Room Notices */
  fetch(process.env.ROOM_URL + '/notice/list' + '?encoding=json')
    .then(res => res.json())
    .then(notices => {
      if (notices.error) return

      state.notices = notices
    })
    .catch(err => console.log('getRoomNotices error:', err)) // returns undefined

  /* Room Name + Members */
  ssb.conn.connect(state.address, (err, rpc) => {
    // NOTE - here we don't currently disconnect from the room after this
    // TODO - test what happens when multiple connections
    if (err) return console.error('failed to connect to room', err)

    let processing = 2
    const done = () => {
      processing--
      if (processing > 0) return
      rpc.close((err) => { // eslint-disable-line
        // if (err) console.error(err)
        console.log('room update finished, disconnected')
      })
    }

    rpc.room.metadata((err, data) => {
      if (err) return console.error(err)
      state.name = data.name
      done()
    })

    pull(
      rpc.room.members({}),
      pullFlatMap(arr => arr),

      /* Follow members (privately) */
      pullParaMap((member, cb) => {
        ssb.friends.isFollowing({ source: ssb.id, dest: member.id }, (err, isFollowing) => {
          if (err) {
            console.error(err)
            cb(null, member)
          }

          if (!isFollowing) {
            ssb.friends.follow(member.id, { state: true, recps: [ssb.id] }, () => {})
          }
          cb(null, member)
        })
      }, 5),

      /* Load current aliases */
      pullParaMap((member, cb) => {
        rpc.room.listAliases(member.id, (err, aliases) => {
          if (err) console.error(err)
          else member.aliases = aliases

          cb(null, member)
        })
      }, 5),

      pull.drain(
        member => {
          state.members.set(member.id, member)
        },
        err => {
          if (err) console.error('rpc.room.members error', err)
          done()
        }
      )
    )
  })
}

function buildMultiserverAddress () {
  const objAddr = {
    host: process.env.ROOM_HOST,
    port: process.env.ROOM_PORT ? Number(process.env.ROOM_PORT) : 8008,
    key: process.env.ROOM_KEY
  }

  if (!ref.isAddress(objAddr)) {
    throw new Error('ROOM_HOST or ROOM_KEY was invalid and couldnt parse the multiserver address')
  }

  return ref.toMultiServerAddress(objAddr)
}
