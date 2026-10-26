import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useLang } from '../../contexts/LangContext'

/**
 * Built-in roles created before a module existed lack its permissions (e.g.
 * Financial Value). Lists what the current templates would add - only
 * additions, never removals, never custom roles - and applies the chosen roles.
 */
export default function RoleTemplateUpdates({ api, onApplied }: { api: { get: (p: string) => Promise<any>; post: (p: string, b?: any) => Promise<any> }; onApplied: () => void }) {
  const { t, isAR } = useLang()
  const [plan, setPlan] = useState<any>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get('/access-governance/role-templates/updates').then((p: any) => { if (Array.isArray(p?.items)) { setPlan(p); setChosen(new Set(p.items.map((i: any) => i.code))) } }).catch(() => setPlan(null))
  }, [api])
  useEffect(() => { load() }, [load])
  if (!plan || !plan.items.length) return null
  const apply = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await api.post('/access-governance/role-templates/updates', { roleCodes: [...chosen] })
      setMsg(t('ag.tpl.done').replace('{n}', String((r.applied || []).length)))
      load(); onApplied()
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }
  return (
    <div data-testid="ag-role-updates" dir={isAR ? 'rtl' : 'ltr'} style={{ background: 'var(--navy-light)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('ag.tpl.title')}<HelpTip text={t('ag.tpl.help')} /></div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{t('ag.tpl.intro')}</div>
      {plan.items.map((i: any) => (
        <div key={i.code} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <label htmlFor={`ag-tpl-${i.code}`} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input id={`ag-tpl-${i.code}`} type="checkbox" checked={chosen.has(i.code)} onChange={e => setChosen(s => { const n = new Set(s); if (e.target.checked) n.add(i.code); else n.delete(i.code); return n })} />
            <span><strong>{i.name}</strong> · {i.action === 'CREATE' ? t('ag.tpl.create') : t('ag.tpl.add').replace('{n}', String(i.permissions.length)).replace('{users}', String(i.users))}
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', direction: 'ltr', textAlign: isAR ? 'right' : 'left' }}>{i.permissions.join(', ')}</span></span>
          </label>
        </div>
      ))}
      <button type="button" disabled={busy || chosen.size === 0} onClick={apply} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--navy)' }}>{busy ? t('ag.tpl.applying') : t('ag.tpl.apply')}</button>
      {msg && <div role="status" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
    </div>
  )
}
