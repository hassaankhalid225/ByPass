import { describe, expect, it } from 'vitest'
import { classifyIp, classifyIpv4, parseIpv4, parseIpv6Groups } from './ip'

describe('parseIpv4', () => {
  it('parses canonical dotted-decimal', () => {
    expect(parseIpv4('127.0.0.1')).toBe(0x7f000001)
    expect(parseIpv4('0.0.0.0')).toBe(0)
    expect(parseIpv4('255.255.255.255')).toBe(0xffffffff)
  })

  it('rejects non-canonical bypass forms', () => {
    expect(parseIpv4('2130706433')).toBeNull() // decimal 127.0.0.1
    expect(parseIpv4('0177.0.0.1')).toBeNull() // octal
    expect(parseIpv4('0x7f.0.0.1')).toBeNull() // hex
    expect(parseIpv4('127.1')).toBeNull() // short form
    expect(parseIpv4('127.0.0.256')).toBeNull() // out of range
    expect(parseIpv4('127.0.0')).toBeNull()
  })
})

describe('classifyIpv4', () => {
  const blocked: [string, string][] = [
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'private'],
    ['172.16.0.1', 'private'],
    ['192.168.1.1', 'private'],
    ['169.254.169.254', 'link-local / cloud metadata'],
    ['100.64.0.1', 'CGNAT'],
    ['0.0.0.0', 'current network'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['198.18.0.1', 'benchmarking'],
  ]

  it.each(blocked)('blocks %s', (ip) => {
    expect(classifyIpv4(parseIpv4(ip)!)).not.toBeNull()
  })

  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '203.0.114.1']
  it.each(allowed)('allows public %s', (ip) => {
    expect(classifyIpv4(parseIpv4(ip)!)).toBeNull()
  })
})

describe('classifyIp — IPv6', () => {
  const blocked = [
    '::1', // loopback
    '::', // unspecified
    'fe80::1', // link-local
    'fc00::1', // unique-local
    'fd12:3456::1', // unique-local
    'ff02::1', // multicast
    '2001:db8::1', // documentation
    '::ffff:127.0.0.1', // ipv4-mapped loopback
    '::ffff:169.254.169.254', // ipv4-mapped metadata
  ]

  it.each(blocked)('blocks %s', (ip) => {
    expect(classifyIp(ip, 6)).not.toBeNull()
  })

  it('allows a public IPv6', () => {
    expect(classifyIp('2606:4700:4700::1111', 6)).toBeNull()
  })
})

describe('parseIpv6Groups', () => {
  it('expands :: correctly', () => {
    expect(parseIpv6Groups('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect(parseIpv6Groups('2001:db8::1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1])
  })

  it('unwraps an embedded IPv4 tail', () => {
    expect(parseIpv6Groups('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001])
  })

  it('strips a zone id and brackets', () => {
    expect(parseIpv6Groups('[fe80::1%eth0]')).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1])
  })
})
