import { hostForTenant, tenantInviteUrl, tenantSignInUrl, tenantSlugForHost } from '../tenantHosts'

describe('tenant addresses', () => {
  it('maps hostnames and tenants both ways', () => {
    expect(tenantSlugForHost('HRDF.archmindworks.com')).toBe('test-tenant')
    expect(hostForTenant('monshaat')).toBe('monshaat.archmindworks.com')
    expect(hostForTenant('unknown')).toBeUndefined()
    expect(hostForTenant(undefined)).toBeUndefined()
  })

  it('signs in on the tenant address with organization and email filled in', () => {
    expect(tenantSignInUrl('test-tenant', 'a@x.sa', 'https://shared.run.app')).toBe('https://hrdf.archmindworks.com/login?org=test-tenant&email=a%40x.sa')
    expect(tenantSignInUrl('other', undefined, 'https://shared.run.app')).toBe('https://shared.run.app/login?org=other')
  })

  it('moves an invitation link to the tenant address, keeping the token', () => {
    expect(tenantInviteUrl('https://ea-platform-ui-1.run.app/invite/abc', 'test-tenant')).toBe('https://hrdf.archmindworks.com/invite/abc')
    expect(tenantInviteUrl('https://ea-platform-ui-1.run.app/invite/abc', 'other')).toBe('https://ea-platform-ui-1.run.app/invite/abc')
    expect(tenantInviteUrl('https://ea-platform-ui-1.run.app/invite/abc', undefined)).toBe('https://ea-platform-ui-1.run.app/invite/abc')
  })
})
