import { useState, useEffect } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

interface Diagram {
  id: string
  title: string
  diagramType: string
  dslFormat: string
  svgContent: string
  sourceCode: string
}

interface DiagramViewerProps {
  cycleId: string
  phase: string
  outputKey: string
}

export function DiagramViewer({ cycleId, phase, outputKey }: DiagramViewerProps) {
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [selected, setSelected] = useState<Diagram | null>(null)
  const [mode, setMode] = useState<'visual' | 'source'>('visual')
  const [fullscreen, setFullscreen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const token = () => localStorage.getItem('ea_token')

  useEffect(() => {
    fetch(`${API_URL}/diagrams/output?cycleId=${cycleId}&phase=${phase}&outputKey=${outputKey}`, {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setDiagrams(data)
        setSelected(data[0])
      }
    }).catch(() => {})
  }, [cycleId, phase, outputKey])

  const downloadSvg = (diag: Diagram) => {
    const blob = new Blob([diag.svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${diag.title.replace(/\s+/g, '_')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadSource = (diag: Diagram) => {
    const blob = new Blob([diag.sourceCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${diag.title.replace(/\s+/g, '_')}.${diag.dslFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (diagrams.length === 0) return null

  return (
    <div style={{ marginTop: 12, border: '1px solid rgba(3,105,161,0.3)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-mid)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>📊 Diagrams ({diagrams.length})</span>
          {diagrams.length > 1 && diagrams.map((d, i) => (
            <button key={d.id} onClick={() => setSelected(d)}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${selected?.id === d.id ? 'var(--accent)' : 'var(--border)'}`, background: selected?.id === d.id ? 'rgba(3,105,161,0.15)' : 'transparent', color: selected?.id === d.id ? 'var(--accent)' : 'var(--text-dim)' }}>
              {i + 1}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--accent)', background: collapsed ? 'transparent' : 'rgba(3,105,161,0.1)', color: 'var(--accent)' }}>
            {collapsed ? '▼ View' : '▲ Hide'}
          </button>
          {!collapsed && <button onClick={() => setMode(m => m === 'visual' ? 'source' : 'visual')}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)' }}>
            {mode === 'visual' ? '< Source' : '👁 Visual'}
          </button>}
          {selected && <>
            <button onClick={() => downloadSvg(selected)}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)' }}>
              ↓ SVG
            </button>
            <button onClick={() => downloadSource(selected)}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)' }}>
              ↓ Source
            </button>
          </>}
          <button onClick={() => setFullscreen(f => !f)}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)' }}>
            {fullscreen ? '⊡' : '⊞'}
          </button>
        </div>
      </div>

      {/* Content */}
      {selected && !collapsed && (
        <div style={{ position: fullscreen ? 'fixed' : 'relative', top: fullscreen ? 0 : undefined, left: fullscreen ? 0 : undefined, width: fullscreen ? '100vw' : '100%', height: fullscreen ? '100vh' : undefined, background: 'var(--navy)', zIndex: fullscreen ? 9999 : undefined, overflow: 'auto', padding: 12 }}>
          {fullscreen && <button onClick={() => setFullscreen(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'var(--danger)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>✕ Close</button>}
          {mode === 'visual' ? (
            <div dangerouslySetInnerHTML={{ __html: selected.svgContent }}
              style={{ width: '100%', overflow: 'auto', textAlign: 'center' }} />
          ) : (
            <pre style={{ margin: 0, fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 4 }}>
              {selected.sourceCode}
            </pre>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
            {selected.diagramType.toUpperCase()} · {selected.dslFormat} · {selected.title}
          </div>
        </div>
      )}
    </div>
  )
}
