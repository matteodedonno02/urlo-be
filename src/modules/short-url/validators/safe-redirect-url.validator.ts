import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BlockList, isIP } from 'net';

const IPV4_BLOCKLIST = new BlockList();
IPV4_BLOCKLIST.addSubnet('0.0.0.0', 8, 'ipv4');
IPV4_BLOCKLIST.addSubnet('10.0.0.0', 8, 'ipv4');
IPV4_BLOCKLIST.addSubnet('100.64.0.0', 10, 'ipv4');
IPV4_BLOCKLIST.addSubnet('127.0.0.0', 8, 'ipv4');
IPV4_BLOCKLIST.addSubnet('169.254.0.0', 16, 'ipv4');
IPV4_BLOCKLIST.addSubnet('172.16.0.0', 12, 'ipv4');
IPV4_BLOCKLIST.addSubnet('192.0.0.0', 24, 'ipv4');
IPV4_BLOCKLIST.addSubnet('192.0.2.0', 24, 'ipv4');
IPV4_BLOCKLIST.addSubnet('192.168.0.0', 16, 'ipv4');
IPV4_BLOCKLIST.addSubnet('198.18.0.0', 15, 'ipv4');
IPV4_BLOCKLIST.addSubnet('198.51.100.0', 24, 'ipv4');
IPV4_BLOCKLIST.addSubnet('203.0.113.0', 24, 'ipv4');
IPV4_BLOCKLIST.addSubnet('224.0.0.0', 4, 'ipv4');
IPV4_BLOCKLIST.addSubnet('240.0.0.0', 4, 'ipv4');

const IPV6_BLOCKLIST = new BlockList();
IPV6_BLOCKLIST.addSubnet('::', 128, 'ipv6');
IPV6_BLOCKLIST.addSubnet('::1', 128, 'ipv6');
IPV6_BLOCKLIST.addSubnet('64:ff9b::', 96, 'ipv6');
IPV6_BLOCKLIST.addSubnet('100::', 64, 'ipv6');
IPV6_BLOCKLIST.addSubnet('2001:db8::', 32, 'ipv6');
IPV6_BLOCKLIST.addSubnet('fc00::', 7, 'ipv6');
IPV6_BLOCKLIST.addSubnet('fe80::', 10, 'ipv6');
IPV6_BLOCKLIST.addSubnet('ff00::', 8, 'ipv6');

export function isSafeRedirectUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    return false;
  }

  if (!url.hostname) {
    return false;
  }

  return !isBlockedHostname(url.hostname);
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = stripBrackets(hostname).toLowerCase();
  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    return IPV4_BLOCKLIST.check(normalized, 'ipv4');
  }

  if (ipVersion === 6) {
    const mappedIpv4 = extractMappedIpv4(normalized);
    if (mappedIpv4 && IPV4_BLOCKLIST.check(mappedIpv4, 'ipv4')) {
      return true;
    }
    return IPV6_BLOCKLIST.check(normalized, 'ipv6');
  }

  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.home.arpa') ||
    !lower.includes('.')
  );
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function parseIpv6Group(group: string): number | null {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
    return null;
  }
  return parseInt(group, 16);
}

function expandIpv6(hostname: string): number[] | null {
  const parts = hostname.split('::');
  if (parts.length > 2) {
    return null;
  }

  if (parts.length === 1) {
    const groups = parts[0].split(':').map(parseIpv6Group);
    if (groups.some((group) => group === null) || groups.length !== 8) {
      return null;
    }
    return groups as number[];
  }

  const [leftPart, rightPart] = parts;
  const left = leftPart ? leftPart.split(':').map(parseIpv6Group) : [];
  const right = rightPart ? rightPart.split(':').map(parseIpv6Group) : [];
  if (
    left.some((group) => group === null) ||
    right.some((group) => group === null)
  ) {
    return null;
  }

  const missing = 8 - left.length - right.length;
  if (missing < 1) {
    return null;
  }

  return [
    ...(left as number[]),
    ...new Array<number>(missing).fill(0),
    ...(right as number[]),
  ];
}

function toIpv4FromGroups(groups: number[]): string {
  return `${groups[6] >>> 8}.${groups[6] & 0xff}.${groups[7] >>> 8}.${groups[7] & 0xff}`;
}

function extractMappedIpv4(hostname: string): string | null {
  const groups = expandIpv6(hostname);
  if (!groups) {
    return null;
  }

  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    return toIpv4FromGroups(groups);
  }

  // NAT64 well-known prefix (64:ff9b::/96)
  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    return toIpv4FromGroups(groups);
  }

  return null;
}

@ValidatorConstraint({ name: 'isSafeRedirectUrl', async: false })
export class IsSafeRedirectUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isSafeRedirectUrl(value);
  }

  defaultMessage(): string {
    return 'originalUrl must be a valid http(s) URL pointing to a public host';
  }
}

export function IsSafeRedirectUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeRedirectUrlConstraint,
    });
  };
}
