const alice = {
  id: '@o0niwCHrEpVjjDJbGOHGCBvLsCzAqTD3I2AI9oYAdPc=.ed25519',
  name: 'alice',
  // publicWebHosting: undefined,
  keys: {
    id: '@o0niwCHrEpVjjDJbGOHGCBvLsCzAqTD3I2AI9oYAdPc=.ed25519',
    public: 'o0niwCHrEpVjjDJbGOHGCBvLsCzAqTD3I2AI9oYAdPc=.ed25519',
    private: 'tgYBqI7/iBedtkdWjGM4UG7+Swo0s1W1jUsVCHYxn3WjSeLAIesSlWOMMlsY4cYIG8uwLMCpMPcjYAj2hgB09w==.ed25519',
    curve: 'ed25519'
  }
}

const bob = {
  id: '@PL3neZVFdnZb7IxnpghZXQRGg5mhrLoWHduXSgJTRkE=.ed25519',
  name: 'bob',
  publicWebHosting: false,
  keys: {
    id: '@PL3neZVFdnZb7IxnpghZXQRGg5mhrLoWHduXSgJTRkE=.ed25519',
    public: 'PL3neZVFdnZb7IxnpghZXQRGg5mhrLoWHduXSgJTRkE=.ed25519',
    private: '2hdKk2ySfzqgJK1nP2WQlsQDyhAyEfCr8PEWQ2pgF1U8ved5lUV2dlvsjGemCFldBEaDmaGsuhYd25dKAlNGQQ==.ed25519',
    curve: 'ed25519'
  }
}

const carol = {
  id: '@A5slLcnOnYhP/UBKVg+ikpDH/ZZ79pWMA6jQUkV+iK0=.ed25519',
  name: 'carol',
  publicWebHosting: true,
  keys: {
    id: '@A5slLcnOnYhP/UBKVg+ikpDH/ZZ79pWMA6jQUkV+iK0=.ed25519',
    public: 'A5slLcnOnYhP/UBKVg+ikpDH/ZZ79pWMA6jQUkV+iK0=.ed25519',
    private: '8XrVUV3J2hMQ5mKGmnsge8YP6kB4sDE7msF77AsFHWUDmyUtyc6diE/9QEpWD6KSkMf9lnv2lYwDqNBSRX6IrQ==.ed25519',
    curve: 'ed25519'
  }
}

module.exports = {
  alice,
  bob,
  carol
}
