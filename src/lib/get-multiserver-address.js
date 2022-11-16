require('dotenv').config({ path: '../.env' })
const ref = require('ssb-ref')

module.exports = function getMultiserverAddress () {
  if (!process.env.ROOM_KEY || !process.env.ROOM_HOST) return

  var objAddr = {
    host: process.env.ROOM_HOST,
    port: 8008,
    key: process.env.ROOM_KEY
  }
  
  if (!ref.isAddress(objAddr)) {
    throw new Error('ROOM_HOST or ROOM_KEY was invalid and couldnt parse the multiserver address')
  }
  
  return ref.toMultiServerAddress(objAddr)
}
