// Shared value-editor helpers for DynamicFilterBuilder - kept separate so
// the main component file stays focused on structure/layout. Mirrors the
// backend's operator-definitions.ts operator families (see
// apps/api/src/architecture-query/operator-definitions.ts) - the frontend
// never invents its own operator list; it only renders whatever the
// backend's /architecture-query/filter-definition response actually
// returned for a given attribute, per the task's explicit "operators must
// come from the backend/discovery semantics" requirement.

export const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: 'equals', NOT_EQUALS: 'does not equal', CONTAINS: 'contains', NOT_CONTAINS: 'does not contain',
  STARTS_WITH: 'starts with', ENDS_WITH: 'ends with',
  IS: 'is', IS_NOT: 'is not', IN: 'is any of', NOT_IN: 'is none of',
  GT: 'greater than', GTE: 'greater than or equal to', LT: 'less than', LTE: 'less than or equal to', BETWEEN: 'between',
  BEFORE: 'before', AFTER: 'after', ON: 'on',
  TRUE: 'is true', FALSE: 'is false',
  IS_EMPTY: 'has no value', IS_NOT_EMPTY: 'has a value', HAS_VALUE: 'has a value', MISSING_VALUE: 'has no value',
}

// Operators that need no value input at all (the condition is complete as
// "Field | Operator") - presence checks and boolean checks.
export const VALUELESS_OPERATORS = new Set(['IS_EMPTY', 'IS_NOT_EMPTY', 'HAS_VALUE', 'MISSING_VALUE', 'TRUE', 'FALSE'])
// Operators needing two values (a range).
export const RANGE_OPERATORS = new Set(['BETWEEN'])
// Operators needing a multi-select value (IN/NOT_IN).
export const MULTI_VALUE_OPERATORS = new Set(['IN', 'NOT_IN'])

export function inputTypeForDataType(dataType: string): 'text' | 'number' | 'date' | 'datetime-local' {
  if (['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'MATURITY_SCORE'].includes(dataType)) return 'number'
  if (dataType === 'DATE') return 'date'
  if (dataType === 'DATETIME') return 'datetime-local'
  return 'text'
}
