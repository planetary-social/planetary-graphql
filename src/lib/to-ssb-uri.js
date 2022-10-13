const DEFAULT_PORT = require('ssb-serve-blobs/port')

// NOTE: copied from ssb-serve-blobs with tweaks
module.exports = function idToUrl (blobId, params) {
  const port = (params && params.port) || DEFAULT_PORT
  const [pureBlobId, query] = blobId.split('?')
  const blobRef = encodeURIComponent(pureBlobId)
  const paramsStr = query
    ? '?' + query
    : params && params.unbox
      ? `?unbox=${encodeURIComponent(params.unbox.toString('base64'))}.boxs`
      : ''

  return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
    ? `http://localhost:${port}/get/${blobRef}${paramsStr}`
    : `${process.env.BLOBS_URL}/${blobRef}${paramsStr}`
}
