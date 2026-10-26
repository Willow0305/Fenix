import { contentSecurityPolicy } from './csp';

describe('contentSecurityPolicy', () => {
  it('em produção só aceita script com o nonce da página', () => {
    const policy = contentSecurityPolicy('abc123', true);

    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
  });

  it('em desenvolvimento libera eval e websocket do recarregamento', () => {
    const policy = contentSecurityPolicy('abc123', false);

    expect(policy).toContain("'nonce-abc123' 'strict-dynamic' 'unsafe-eval'");
    expect(policy).toContain("connect-src 'self' ws:");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});
