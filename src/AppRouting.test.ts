import fs from 'fs'
import path from 'path'

describe('public and authenticated route contract', () => {
  const appSource = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8')

  it('maps the apex public root to the ArqOps landing page and tenant roots to /app', () => {
    expect(appSource).toContain("'archmindworks.com', 'www.archmindworks.com'")
    expect(appSource).toContain('return isPublicLandingHost() ? <LandingPage /> : <Navigate to="/app" replace />')
    expect(appSource).toContain('<Route path="/" element={<RootEntry />} />')
  })

  it('keeps login public and places the dashboard behind ProtectedRoute at /app', () => {
    expect(appSource).toContain('<Route path="/login" element={<LoginPage />} />')
    expect(appSource).toContain('<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>')
    expect(appSource).toContain('<Route path="/app" element={<DashboardPage />} />')
  })

  it('redirects anonymous users to login and denied permissions to the dashboard', () => {
    expect(appSource).toContain('if (!user) return <Navigate to="/login" replace />')
    expect(appSource).toContain("if (superadminOnly && user.role !== 'SUPERADMIN') return <Navigate to=\"/app\" replace />")
    expect(appSource).toContain('if (permission && !hasPermission(permission)) return <Navigate to="/app" replace />')
  })
})
