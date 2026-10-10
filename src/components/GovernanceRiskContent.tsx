import React from 'react'

export function riskDisplayText(risk: any) {
  const title = risk.riskTitle?.trim() || risk.riskStatement?.trim() || ''
  return { title, statement: risk.riskStatement?.trim() !== title ? risk.riskStatement?.trim() : '', treatment: risk.mitigation?.trim() || risk.recommendation?.trim() || '' }
}

export default function GovernanceRiskContent({ risk, isAR }: { risk: any; isAR: boolean }) {
  const { statement, treatment } = riskDisplayText(risk)
  return <>
    {risk.riskNature === 'DOCUMENTATION_GAP_UNCERTAINTY' && <div style={{ fontSize: 12, marginBottom: 6 }}>{isAR ? 'نقص المعلومات يسبب عدم يقين؛ وليس خطراً مثبتاً' : 'Missing information creates uncertainty; this is not a demonstrated risk'}</div>}
    {(risk.probability || risk.owner) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 12 }}>
      {risk.probability && <div>{isAR ? 'الاحتمالية: ' : 'Probability: '}{risk.probability}</div>}
      {risk.owner && <div>{isAR ? 'المسؤول: ' : 'Owner: '}{risk.owner}</div>}
    </div>}
    {statement && <div style={{ fontSize: 12, marginBottom: 6 }}>{statement}</div>}
    {risk.impact && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{isAR ? 'الأثر: ' : 'Impact: '}{risk.impact}</div>}
    {treatment && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>{isAR ? 'إجراء المعالجة: ' : 'Mitigation: '}{treatment}</div>}
    {risk.evidence && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isAR ? 'الدليل: ' : 'Evidence: '}{risk.evidence}</div>}
  </>
}
