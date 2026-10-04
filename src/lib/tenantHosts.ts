/**
 * Tenants that have their own web address. Visiting one of these hostnames
 * selects the tenant at sign-in, and invitation links / the sign-in after
 * accepting an invitation point there instead of the shared platform URL.
 */
export const TENANT_HOSTS: Record<string, string> = {
  'hrdf.archmindworks.com': 'test-tenant',
  'monshaat.archmindworks.com': 'monshaat',
}

/** The tenant bound to a hostname, if any. */
export function tenantSlugForHost(hostname: string): string | undefined {
  return TENANT_HOSTS[(hostname || '').toLowerCase()]
}

/** A tenant's own hostname, if it has one. */
export function hostForTenant(slug?: string | null): string | undefined {
  if (!slug) return undefined
  return Object.keys(TENANT_HOSTS).find(h => TENANT_HOSTS[h] === slug)
}

/** The sign-in page for a tenant: its own address when it has one, with the organization and email filled in. */
export function tenantSignInUrl(slug: string, email?: string, currentOrigin = window.location.origin): string {
  const host = hostForTenant(slug)
  const params = new URLSearchParams({ org: slug, ...(email ? { email } : {}) })
  return `${host ? `https://${host}` : currentOrigin}/login?${params.toString()}`
}

/** An invitation link moved to the tenant's own address (unchanged when it has none). */
export function tenantInviteUrl(url: string, slug?: string | null): string {
  const host = hostForTenant(slug)
  if (!host || !url) return url
  try { const u = new URL(url); u.protocol = 'https:'; u.host = host; return u.toString() } catch { return url }
}
