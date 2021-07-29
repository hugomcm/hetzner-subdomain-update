const https = require('https')
const querystring = require('querystring')

const dns = require('dns')

const Async = require('crocks/Async')
const { Rejected, Resolved } = Async

const dnsResolve = hostname =>
  Async((l, r) => {
    dns.setServers(['8.8.8.8'])
    dns.resolve4(hostname, (err, addresses) => (!err && addresses.length > 0 ? r(addresses[0]) : r(err.message)))
  })

const buildBaseCall =
  options =>
  (servicePathXs, qsObj, method = 'GET', reqBody) => {
    const myoptns = { ...options }
    myoptns.path = myoptns.path || ''
    myoptns.path = !!servicePathXs ? myoptns.path + '/' + servicePathXs.join('/') : myoptns.path
    qsObj = qsObj || {}
    myoptns.path = Object.keys(qsObj).length === 0 ? myoptns.path : myoptns.path + '?' + querystring.stringify(qsObj)
    myoptns.method = method

    // log(myoptns)
    return Async((l, r) => {
      const req = https.request(myoptns, res => {
        let resBody = ''
        // log(res)
        res.on('data', d => {
          resBody = resBody.concat(d)
          // process.stdout.write(d)
        })

        res.on('end', () =>
          res.headers['content-type'] === 'application/json; charset=utf-8' ? r(JSON.parse(resBody)) : r(resBody)
        )
      })

      req.on('error', error => {
        // log('bbb')
        l(error)
      })

      if (['POST', 'PUT'].includes(method) && !!reqBody) req.write(JSON.stringify(reqBody))

      req.end()
    })
  }

function HetznerDns() {
  const token = process.env.HETZNER_DNS_TOKEN
  // log({ token })
  const options = {
    hostname: 'dns.hetzner.com',
    port: 443,
    path: '/api/v1',
    headers: {
      'Auth-API-Token': token,
    },
  }

  const baseCall = buildBaseCall(options)

  // curl "https://dns.hetzner.com/api/v1/zones" -H "Auth-API-Token: $token"
  // getZoneId :: string -> Async e a
  const getZoneId = tld =>
    baseCall(['zones'])
      .map(res => (res && res.zones ? res.zones.find(({ name }) => name === tld) : false))
      .chain(res => (!res ? Rejected(`No zone id for tld '${tld}'`) : Resolved(res)))
      .map(res => res.id)

  // curl "https://dns.hetzner.com/api/v1/records?zone_id={ZoneID}" -H 'Auth-API-Token: LlGoDUQ39S6akqoav5meAsv5OIpeywhj'
  // getDnsRecord :: (string, string) -> Async e a
  const getDnsRecord = (zoneId, recordName) =>
    baseCall(['records'], { zone_id: zoneId })
      .map(res => (res && res.records ? res.records.find(({ name }) => name === recordName) : false))
      .chain(res => (!res ? Rejected(`No record named '${recordName}' on zone_id '${zoneId}'`) : Resolved(res)))

  // curl -X "POST" "https://dns.hetzner.com/api/v1/records" \
  //     -H 'Content-Type: application/json' \
  //     -H 'Auth-API-Token: LlGoDUQ39S6akqoav5meAsv5OIpeywhj' \
  //     -d $'{
  //   "value": "1.1.1.1",
  //   "ttl": 86400,
  //   "type": "A",
  //   "name": "www",
  //   "zone_id": "1"
  // }'
  // createDnsRecord :: string -> string -> string -> Async e a
  const createDnsRecord = zoneId => recordName => value =>
    baseCall(['records'], undefined, 'POST', {
      zone_id: zoneId,
      type: 'A',
      name: recordName,
      value,
      ttl: 1800,
    }).map(({ record }) => record)

  // curl -X "PUT" "https://dns.hetzner.com/api/v1/records/{RecordID}" \
  //     -H 'Content-Type: application/json' \
  //     -H 'Auth-API-Token: LlGoDUQ39S6akqoav5meAsv5OIpeywhj' \
  //     -d $'{
  //   "value": "1.1.1.2",
  //   "ttl": 0,
  //   "type": "A",
  //   "name": "www",
  //   "zone_id": "oH7shFebR6nLPgTnmvNjM8"
  // }'
  // updateDnsRecord :: string -> Record -> string -> Async e a
  const updateDnsRecord = originalRecord => value =>
    baseCall(['records', originalRecord.id], undefined, 'PUT', { ...originalRecord, value }).map(({ record }) => record)

  // curl "https://dns.hetzner.com/api/v1/records/{RecordID}" -H 'Auth-API-Token: LlGoDUQ39S6akqoav5meAsv5OIpeywhj'
  // setDnsRecord :: string -> string -> Async l r -> Async l r
  const setDnsRecord = zoneId => recordName => asyncValue =>
    asyncValue.chain(value =>
      getDnsRecord(zoneId, recordName).bichain(
        _ =>
          createDnsRecord(zoneId)(recordName)(value).map(
            ({ name, type, value, modified }) =>
              `Created dns record '${name}' type '${type}' with '${value}' @ ${modified}`
          ),
        record =>
          record.value !== value
            ? updateDnsRecord(record)(value).map(
                ({ name, type, value, modified }) =>
                  `Updated dns record '${name}' type '${type}' with '${value}' @ ${modified}`
              )
            : Rejected('Nothing changed!!')
      )
    )

  return {
    getZoneId, //
    setDnsRecord,
  }
}

function ExternalIp() {
  // const baseCall = buildBaseCall({
  //   hostname: 'ifconfig.io',
  //   port: 443,
  // })
  const baseCall = buildBaseCall({
    hostname: 'ipinfo.io',
    port: 443,
  })

  return {
    // curl "https://dns.hetzner.com/api/v1/zones" -H "Auth-API-Token: $token"
    getExternalIp: baseCall(['ip']).map(res => res.trim()),
  }
}

const { getZoneId, setDnsRecord } = HetznerDns()
const { getExternalIp } = ExternalIp()

const updateRecord = (tld, recordName) =>
  Async.all([dnsResolve(recordName + '.' + tld), getExternalIp])
    //
    .chain(([dnsIp, currentIp]) =>
      dnsIp !== currentIp
        ? getZoneId(tld).chain(zoneId => setDnsRecord(zoneId)(recordName)(getExternalIp))
        : Rejected('Nothing changed!')
    )

module.exports = {
  updateRecord,
}
