log = console.log
const { updateRecord } = require('./services.js')

if (!process.argv[2]) {
  log('No subdomain defined')
  process.exit(1)
}

const xs = process.argv[2].split('.')
if (xs.length < 3) {
  log(`Invalid subdomain: ${process.argv[2]}`)
  process.exit(2)
}

if (!process.env.HETZNER_DNS_TOKEN) {
  log(`Please define the environment variable $HETZNER_DNS_TOKEN in order to access your DNS API`)
  process.exit(3)
}

const tld = xs.slice(xs.length - 2).join('.')
const recordName = xs.slice(0, xs.length - 2).join('.')
// log('tld', tld)
// log('recordName', recordName)

updateRecord(tld, recordName).fork(
  err => {
    console.error(err)
    process.exit(4)
  },
  res => log(res)
)
