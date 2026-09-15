import { useEffect, useState, useCallback } from 'react'
import { OPERATOR_LABELS, VALUELESS_OPERATORS, RANGE_OPERATORS, MULTI_VALUE_OPERATORS, inputTypeForDataType } from './filterBuilderHelpers'

// ── Shared Meta Model-Driven Dynamic Filter Builder ─────────────────────────
//
// ONE component, used by both EA Repository (RepositoryPage) and EA Views
// (EaViewsPage) - per the task's explicit "do not build two independent
// implementations" requirement. Entirely driven by
// GET /architecture-query/filter-definition and produces the exact
// ConditionGroup structured-query shape ArchitectureQueryService already
// validates and executes (see architecture-query.types.ts on the backend) -
// no separate frontend query representation.
//
// Deliberately NOT a developer-oriented rule-engine UI: no JSON, no
// relationshipDefinitionId/objectTypeId visible to the user - those are
// held internally and only canonical display labels are shown.

export interface FilterAttributeDef { code: string; name: string; dataType: string; enumValues?: { code: string; label: string }[]; supportedOperators: string[] }
export interface FilterRelationshipDef { relationshipDefId: string; forwardLabel: string; reverseLabel: string | null; direction: 'OUTGOING' | 'INCOMING'; relatedObjectType: string; relatedObjectTypeName: string }
export interface FilterDefinition { objectType: string; identityFields: FilterAttributeDef[]; attributes: FilterAttributeDef[]; relationships: FilterRelationshipDef[] }

type AttrCondition = { type: 'ATTRIBUTE'; attributeCode: string; operator: string; value?: any }
type RelCondition = { type: 'RELATIONSHIP'; relationshipDefId: string; direction: 'OUTGOING' | 'INCOMING'; operator: 'EXISTS' | 'NOT_EXISTS'; relatedConditions?: { operator: 'AND' | 'OR'; conditions: AttrCondition[] } }
type Condition = AttrCondition | RelCondition
// One practical level of nested grouping for V1 (task's explicit scope) -
// a NestedGroup holds only plain Conditions, never another NestedGroup.
// Matches the backend's ConditionGroup shape exactly for a nested entry
// (operator + conditions, no discriminator field) - see
// architecture-query.types.ts's isConditionGroup(), which distinguishes a
// nested group from a condition by checking for the operator field, not a
// type tag; this frontend type does the same via isGroup() below, so what
// gets built here serializes directly as a valid backend ConditionGroup
// with no translation step.
type NestedGroup = { operator: 'AND' | 'OR'; conditions: Condition[] }
type Node = Condition | NestedGroup
type Group = { operator: 'AND' | 'OR'; conditions: Node[] }
export type ConditionGroup = Group

function isGroup(node: Node): node is NestedGroup {
  return !('type' in node)
}

interface Props {
  objectType: string // real Meta Model object type code, or '' if none selected yet
  api: { get: (path: string) => Promise<any> }
  value: ConditionGroup | null
  onChange: (group: ConditionGroup | null) => void
  onApply: () => void
  onClear: () => void
  locale?: 'EN' | 'AR'
}

const emptyGroup = (): Group => ({ operator: 'AND', conditions: [] })

export default function DynamicFilterBuilder({ objectType, api, value, onChange, onApply, onClear, locale = 'EN' }: Props) {
  const [definition, setDefinition] = useState<FilterDefinition | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const group = value ?? emptyGroup()

  const loadDefinition = useCallback(async () => {
    if (!objectType) { setDefinition(null); return }
    setLoading(true)
    setError(null)
    try {
      const def = await api.get(`/architecture-query/filter-definition?objectType=${encodeURIComponent(objectType)}`)
      // Defensive: treat a malformed/unexpected response shape (e.g. an
      // API mock or gateway returning {} for an unrecognized path, a 404
      // body, etc.) the same as a failed load, rather than crashing on
      // `definition.identityFields` being undefined further down.
      if (!def || !Array.isArray(def.identityFields) || !Array.isArray(def.attributes) || !Array.isArray(def.relationships)) {
        throw new Error('malformed filter definition response')
      }
      setDefinition(def)
    } catch (e: any) {
      // Task section 18: "Meta Model definition changed after builder
      // opened" - surfaced as a clear, actionable message, not a silent
      // fallback to a stale/empty filter list.
      setError(locale === 'AR' ? 'تعذّر تحميل الفلاتر المتاحة لهذا النوع.' : 'Could not load available filters for this object type.')
      setDefinition(null)
    } finally {
      setLoading(false)
    }
  }, [objectType, api, locale])

  useEffect(() => { loadDefinition() }, [loadDefinition])

  // Task section 18: if the Meta Model changed after the builder opened
  // and a condition now references an attribute/relationship no longer
  // present, drop just that condition and tell the user - never silently
  // broaden the query by ignoring the mismatch.
  useEffect(() => {
    if (!definition || group.conditions.length === 0) return
    const validCodes = new Set([...definition.identityFields, ...definition.attributes].map(a => a.code))
    const validRelIds = new Set(definition.relationships.map(r => r.relationshipDefId))
    const isConditionValid = (c: Condition) => (c.type === 'ATTRIBUTE' ? validCodes.has(c.attributeCode) : validRelIds.has(c.relationshipDefId))
    let removedAny = false
    const stillValid: Node[] = []
    for (const node of group.conditions) {
      if (isGroup(node)) {
        const remaining = node.conditions.filter(isConditionValid)
        if (remaining.length !== node.conditions.length) removedAny = true
        if (remaining.length > 0) stillValid.push({ ...node, conditions: remaining })
        else removedAny = true
      } else if (isConditionValid(node)) {
        stillValid.push(node)
      } else {
        removedAny = true
      }
    }
    if (removedAny) {
      setError(locale === 'AR' ? 'تمت إزالة بعض الشروط لأنها لم تعد متاحة في نموذج البيانات الحالي.' : 'Some conditions were removed because they are no longer available in the current Meta Model.')
      onChange(stillValid.length ? { ...group, conditions: stillValid } : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition])

  if (!objectType) return null

  const allFields = definition ? [...definition.identityFields, ...definition.attributes] : []

  const updateNode = (index: number, next: Node) => {
    const conditions = [...group.conditions]
    conditions[index] = next
    onChange({ ...group, conditions })
  }
  const removeNode = (index: number) => {
    const conditions = group.conditions.filter((_, i) => i !== index)
    onChange(conditions.length ? { ...group, conditions } : null)
  }
  const newAttributeCondition = (): AttrCondition | null => {
    const first = allFields[0]
    return first ? { type: 'ATTRIBUTE', attributeCode: first.code, operator: first.supportedOperators[0], value: '' } : null
  }
  const addAttributeCondition = () => {
    const c = newAttributeCondition()
    if (c) onChange({ ...group, conditions: [...group.conditions, c] })
  }
  const addRelationshipCondition = () => {
    const first = definition?.relationships[0]
    if (!first) return
    onChange({ ...group, conditions: [...group.conditions, { type: 'RELATIONSHIP', relationshipDefId: first.relationshipDefId, direction: first.direction, operator: 'EXISTS' }] })
  }
  // Task's own worked example: "Add Group" starts a nested (Field |
  // Operator | Value) OR (Field | Operator | Value) - one practical level
  // of nesting, not unrestricted recursion. The group starts with 2
  // conditions (rather than 0) since a 1-condition group is not
  // meaningfully different from a plain top-level condition - avoids an
  // awkward empty-group intermediate state in the common case.
  const addGroup = () => {
    const c1 = newAttributeCondition()
    const c2 = newAttributeCondition()
    if (!c1 || !c2) return
    const newGroup: NestedGroup = { operator: 'OR', conditions: [c1, c2] }
    onChange({ ...group, conditions: [...group.conditions, newGroup] })
  }
  const setGroupOperator = (operator: 'AND' | 'OR') => onChange({ ...group, operator })

  return (
    <div className="dfb-root" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy-light)', padding: 14, marginBottom: 16 }}>
      {loading && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{locale === 'AR' ? 'جارٍ تحميل الفلاتر...' : 'Loading filters…'}</div>}
      {error && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
      {!loading && definition && (
        <>
          {group.conditions.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{locale === 'AR' ? 'لا توجد شروط بعد.' : 'No conditions yet.'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {group.conditions.map((node, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <button type="button" onClick={() => setGroupOperator('AND')} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: group.operator === 'AND' ? 'var(--accent)' : 'transparent', color: group.operator === 'AND' ? '#fff' : 'var(--text-dim)', cursor: 'pointer' }}>AND</button>
                      <button type="button" onClick={() => setGroupOperator('OR')} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: group.operator === 'OR' ? 'var(--accent)' : 'transparent', color: group.operator === 'OR' ? '#fff' : 'var(--text-dim)', cursor: 'pointer' }}>OR</button>
                    </div>
                  )}
                  {isGroup(node)
                    ? <NestedGroupBox group={node} fields={allFields} onChange={next => updateNode(i, next)} onRemove={() => removeNode(i)} locale={locale} />
                    : node.type === 'ATTRIBUTE'
                      ? <AttributeConditionRow condition={node} fields={allFields} onChange={next => updateNode(i, next)} onRemove={() => removeNode(i)} locale={locale} />
                      : <RelationshipConditionRow condition={node} relationships={definition.relationships} api={api} onChange={next => updateNode(i, next)} onRemove={() => removeNode(i)} locale={locale} />}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={addAttributeCondition} className="arq-button" style={{ fontSize: 12, padding: '6px 12px' }}>+ {locale === 'AR' ? 'إضافة شرط' : 'Add condition'}</button>
            {definition.relationships.length > 0 && (
              <button type="button" onClick={addRelationshipCondition} className="arq-button" style={{ fontSize: 12, padding: '6px 12px' }}>+ {locale === 'AR' ? 'إضافة علاقة' : 'Add relationship'}</button>
            )}
            <button type="button" onClick={addGroup} className="arq-button" style={{ fontSize: 12, padding: '6px 12px' }}>+ {locale === 'AR' ? 'إضافة مجموعة' : 'Add group'}</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => { onClear(); }} style={{ fontSize: 12, padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer' }}>{locale === 'AR' ? 'مسح' : 'Clear'}</button>
            <button type="button" onClick={onApply} disabled={group.conditions.length === 0} className="arq-button" style={{ fontSize: 12, padding: '6px 14px', fontWeight: 700, opacity: group.conditions.length === 0 ? 0.5 : 1 }}>{locale === 'AR' ? 'تطبيق' : 'Apply filters'}</button>
          </div>
        </>
      )}
    </div>
  )
}

function NestedGroupBox({ group, fields, onChange, onRemove, locale }: { group: NestedGroup; fields: FilterAttributeDef[]; onChange: (g: NestedGroup) => void; onRemove: () => void; locale: 'EN' | 'AR' }) {
  const updateCondition = (index: number, next: AttrCondition) => {
    const conditions = [...group.conditions]; conditions[index] = next
    onChange({ ...group, conditions })
  }
  const removeCondition = (index: number) => {
    const conditions = group.conditions.filter((_, i) => i !== index)
    // A group with zero conditions is degenerate - remove the whole group
    // rather than leaving an empty {operator, conditions:[]} node behind.
    if (conditions.length === 0) { onRemove(); return }
    onChange({ ...group, conditions })
  }
  const addCondition = () => {
    const first = fields[0]
    if (!first) return
    onChange({ ...group, conditions: [...group.conditions, { type: 'ATTRIBUTE', attributeCode: first.code, operator: first.supportedOperators[0], value: '' }] })
  }
  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 6, padding: 10, background: 'rgba(99,102,241,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{locale === 'AR' ? 'مجموعة' : 'Group'}</span>
        <button type="button" onClick={onRemove} aria-label={locale === 'AR' ? 'إزالة المجموعة' : 'Remove group'} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.conditions.map((c, i) => (
          <div key={i}>
            {i > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button type="button" onClick={() => onChange({ ...group, operator: 'AND' })} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', background: group.operator === 'AND' ? 'var(--accent)' : 'transparent', color: group.operator === 'AND' ? '#fff' : 'var(--text-dim)', cursor: 'pointer' }}>AND</button>
                <button type="button" onClick={() => onChange({ ...group, operator: 'OR' })} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', background: group.operator === 'OR' ? 'var(--accent)' : 'transparent', color: group.operator === 'OR' ? '#fff' : 'var(--text-dim)', cursor: 'pointer' }}>OR</button>
              </div>
            )}
            <AttributeConditionRow condition={c} fields={fields} onChange={next => updateCondition(i, next)} onRemove={() => removeCondition(i)} locale={locale} />
          </div>
        ))}
      </div>
      <button type="button" onClick={addCondition} style={{ fontSize: 11, padding: '3px 8px', marginTop: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer' }}>
        + {locale === 'AR' ? 'شرط' : 'Condition'}
      </button>
    </div>
  )
}

function ValueInput({ field, operator, value, onChange }: { field: FilterAttributeDef; operator: string; value: any; onChange: (v: any) => void }) {
  if (VALUELESS_OPERATORS.has(operator)) return null
  if (field.dataType === 'ENUM' || field.dataType === 'MULTI_ENUM') {
    if (MULTI_VALUE_OPERATORS.has(operator)) {
      const selected: string[] = Array.isArray(value) ? value : []
      return (
        <select multiple className="form-input" style={{ minWidth: 140 }} value={selected} onChange={e => onChange(Array.from(e.target.selectedOptions, o => o.value))}>
          {field.enumValues?.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
        </select>
      )
    }
    return (
      <select className="form-input" style={{ minWidth: 140 }} value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">…</option>
        {field.enumValues?.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
      </select>
    )
  }
  const inputType = inputTypeForDataType(field.dataType)
  if (RANGE_OPERATORS.has(operator)) {
    const [from, to] = Array.isArray(value) ? value : ['', '']
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type={inputType} className="form-input" style={{ width: 130 }} value={from} onChange={e => onChange([e.target.value, to])} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>–</span>
        <input type={inputType} className="form-input" style={{ width: 130 }} value={to} onChange={e => onChange([from, e.target.value])} />
      </div>
    )
  }
  return <input type={inputType} className="form-input" style={{ minWidth: 140 }} value={value ?? ''} onChange={e => onChange(inputType === 'number' ? Number(e.target.value) : e.target.value)} />
}

function AttributeConditionRow({ condition, fields, onChange, onRemove, locale }: { condition: AttrCondition; fields: FilterAttributeDef[]; onChange: (c: AttrCondition) => void; onRemove: () => void; locale: 'EN' | 'AR' }) {
  const field = fields.find(f => f.code === condition.attributeCode) || fields[0]
  if (!field) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: 'var(--navy-mid)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <select className="form-input" style={{ minWidth: 140 }} value={condition.attributeCode} onChange={e => {
        const nextField = fields.find(f => f.code === e.target.value)!
        onChange({ ...condition, attributeCode: nextField.code, operator: nextField.supportedOperators[0], value: '' })
      }}>
        {fields.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
      </select>
      <select className="form-input" style={{ minWidth: 120 }} value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value, value: '' })}>
        {field.supportedOperators.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>)}
      </select>
      <ValueInput field={field} operator={condition.operator} value={condition.value} onChange={v => onChange({ ...condition, value: v })} />
      <button type="button" onClick={onRemove} aria-label={locale === 'AR' ? 'إزالة' : 'Remove'} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

function RelationshipConditionRow({ condition, relationships, api, onChange, onRemove, locale }: { condition: RelCondition; relationships: FilterRelationshipDef[]; api: { get: (path: string) => Promise<any> }; onChange: (c: RelCondition) => void; onRemove: () => void; locale: 'EN' | 'AR' }) {
  const relDef = relationships.find(r => r.relationshipDefId === condition.relationshipDefId) || relationships[0]
  const [relatedDefinition, setRelatedDefinition] = useState<FilterDefinition | null>(null)

  useEffect(() => {
    if (!condition.relatedConditions || !relDef) return
    api.get(`/architecture-query/filter-definition?objectType=${encodeURIComponent(relDef.relatedObjectType)}`).then(setRelatedDefinition).catch(() => setRelatedDefinition(null))
  }, [condition.relatedConditions, relDef, api])

  if (!relDef) return null
  const label = relDef.direction === 'OUTGOING' ? relDef.forwardLabel : (relDef.reverseLabel || relDef.forwardLabel)

  return (
    <div style={{ padding: '8px 10px', background: 'var(--navy-mid)', borderRadius: 6, border: '1px dashed var(--accent)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{locale === 'AR' ? 'علاقة' : 'Relationship'}</span>
        <select className="form-input" style={{ minWidth: 100 }} value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value as 'EXISTS' | 'NOT_EXISTS' })}>
          <option value="EXISTS">{locale === 'AR' ? 'لديه' : 'Has'}</option>
          <option value="NOT_EXISTS">{locale === 'AR' ? 'ليس لديه' : 'Does not have'}</option>
        </select>
        <select className="form-input" style={{ minWidth: 160 }} value={condition.relationshipDefId} onChange={e => {
          const next = relationships.find(r => r.relationshipDefId === e.target.value)!
          onChange({ ...condition, relationshipDefId: next.relationshipDefId, direction: next.direction, relatedConditions: undefined })
        }}>
          {relationships.map(r => <option key={r.relationshipDefId} value={r.relationshipDefId}>{r.direction === 'OUTGOING' ? r.forwardLabel : (r.reverseLabel || r.forwardLabel)} → {r.relatedObjectTypeName}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label} {relDef.relatedObjectTypeName}</span>
        <button type="button" onClick={onRemove} aria-label={locale === 'AR' ? 'إزالة' : 'Remove'} style={{ marginInlineStart: 'auto', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      {condition.operator === 'EXISTS' && (
        <div style={{ marginTop: 8 }}>
          {!condition.relatedConditions ? (
            <button type="button" onClick={() => onChange({ ...condition, relatedConditions: { operator: 'AND', conditions: [] } })} style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer' }}>
              + {locale === 'AR' ? `شرط على ${relDef.relatedObjectTypeName}` : `Condition on ${relDef.relatedObjectTypeName}`}
            </button>
          ) : relatedDefinition ? (
            <div style={{ paddingInlineStart: 16, borderInlineStart: '2px solid var(--border)' }}>
              {condition.relatedConditions.conditions.map((rc, ri) => (
                <AttributeConditionRow
                  key={ri}
                  condition={rc}
                  fields={[...relatedDefinition.identityFields, ...relatedDefinition.attributes]}
                  onChange={next => {
                    const conditions = [...condition.relatedConditions!.conditions]; conditions[ri] = next
                    onChange({ ...condition, relatedConditions: { ...condition.relatedConditions!, conditions } })
                  }}
                  onRemove={() => {
                    const conditions = condition.relatedConditions!.conditions.filter((_, i) => i !== ri)
                    onChange({ ...condition, relatedConditions: conditions.length ? { ...condition.relatedConditions!, conditions } : undefined })
                  }}
                  locale={locale}
                />
              ))}
              <button type="button" onClick={() => {
                const fields = [...relatedDefinition.identityFields, ...relatedDefinition.attributes]
                const first = fields[0]
                if (!first) return
                onChange({ ...condition, relatedConditions: { operator: 'AND', conditions: [...condition.relatedConditions!.conditions, { type: 'ATTRIBUTE', attributeCode: first.code, operator: first.supportedOperators[0], value: '' }] } })
              }} style={{ fontSize: 11, padding: '3px 8px', marginTop: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', cursor: 'pointer' }}>
                + {locale === 'AR' ? 'شرط' : 'Condition'}
              </button>
            </div>
          ) : <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{locale === 'AR' ? 'جارٍ التحميل...' : 'Loading…'}</span>}
        </div>
      )}
    </div>
  )
}
