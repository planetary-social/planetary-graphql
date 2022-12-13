// https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [{
    name: 'graphql',
    script: './index.js',
    // args: ''
    max_memory_restart: '1900M'
  }]
}
