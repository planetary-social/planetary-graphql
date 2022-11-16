if (!process.env.KEY_LOCATION) return

var ssbKeys = require("ssb-keys");

var keys = ssbKeys.loadOrCreateSync(process.env.KEY_LOCATION);
console.log(keys.id)
