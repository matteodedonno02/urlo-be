import { validateSync } from 'class-validator';
import {
  IsSafeRedirectUrl,
  isSafeRedirectUrl,
} from './safe-redirect-url.validator';

class TestDto {
  @IsSafeRedirectUrl()
  originalUrl!: string;
}

describe('safe-redirect-url validator', () => {
  describe('isSafeRedirectUrl', () => {
    it.each([
      'https://evil.com',
      'https://example.com/path?q=1#frag',
      'http://example.com',
      'http://1.1.1.1',
      'http://8.8.8.8:8080/path',
      'http://172.32.0.1',
      'http://example.com.',
      'http://[2606:4700:4700::1111]',
      'HTTP://Example.COM',
      'http:evil.com',
    ])('accepts a public http(s) URL: %s', (url) => {
      expect(isSafeRedirectUrl(url)).toBe(true);
    });

    it.each([
      'http://192.168.1.1',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://172.31.255.254',
      'http://127.0.0.1',
      'http://127.0.0.1:8080',
      'http://169.254.169.254/latest/meta-data',
      'http://0.0.0.0',
      'http://100.64.0.1',
      'http://192.0.2.1',
      'http://198.18.0.1',
      'http://198.51.100.1',
      'http://203.0.113.1',
      'http://224.0.0.1',
      'http://240.0.0.1',
      'http://localhost',
      'http://localhost:8080',
      'http://LOCALHOST',
      'http://foo.localhost',
      'http://router.local',
      'http://printer.home.arpa',
      'http://intranet',
      'http://internal-server',
      'http://[::1]',
      'http://[::1]:8080',
      'http://[::]',
      'http://[fe80::1]',
      'http://[fc00::1]',
      'http://[fd12::1]',
      'http://[2001:db8::1]',
      'http://[::ffff:192.168.1.1]',
      'http://[::ffff:c0a8:101]',
      'http://[::ffff:7f00:1]',
      'http://[64:ff9b::7f00:1]',
      'http://[64:ff9b::c0a8:101]',
      'ftp://x.com',
      'ftp://192.168.1.1',
      'javascript:alert(1)',
      '//evil.com',
      'not a valid url',
      '',
      'http://',
      'mailto:test@example.com',
    ])('rejects a non-public or non-http(s) URL: %s', (url) => {
      expect(isSafeRedirectUrl(url)).toBe(false);
    });

    it('accepts a public IP-mapped IPv6 address', () => {
      expect(isSafeRedirectUrl('http://[::ffff:8.8.8.8]')).toBe(true);
    });
  });

  describe('IsSafeRedirectUrl decorator', () => {
    it('rejects an unsafe URL through class-validator', () => {
      const dto = new TestDto();
      dto.originalUrl = 'http://localhost:8080';
      const errors = validateSync(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('originalUrl');
    });

    it('accepts a safe URL through class-validator', () => {
      const dto = new TestDto();
      dto.originalUrl = 'https://example.com/path';
      const errors = validateSync(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
