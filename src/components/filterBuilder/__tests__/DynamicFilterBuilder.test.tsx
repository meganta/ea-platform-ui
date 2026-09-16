import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DynamicFilterBuilder, { ConditionGroup } from '../DynamicFilterBuilder'

const APPLICATION_DEFINITION = {
  objectType: 'Application',
  identityFields: [{ code: '__status', name: 'Status', dataType: 'ENUM', supportedOperators: ['IS', 'IS_NOT'], enumValues: [{ code: 'ACTIVE', label: 'Active' }, { code: 'PLANNED', label: 'Planned' }] }],
  attributes: [
    { code: 'technologyStack', name: 'Technology Stack', dataType: 'TEXT', supportedOperators: ['EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'] },
    { code: 'businessCriticality', name: 'Criticality', dataType: 'ENUM', supportedOperators: ['IS', 'IS_NOT'], enumValues: [{ code: 'high', label: 'High' }, { code: 'low', label: 'Low' }] },
    { code: 'userCount', name: 'User Count', dataType: 'INTEGER', supportedOperators: ['EQUALS', 'GT', 'LT'] },
    { code: 'launchDate', name: 'Launch Date', dataType: 'DATE', supportedOperators: ['BEFORE', 'AFTER'] },
    { code: 'isActive', name: 'Is Active', dataType: 'BOOLEAN', supportedOperators: ['TRUE', 'FALSE'] },
  ],
  relationships: [{ relationshipDefId: 'rel-1', forwardLabel: 'supports', reverseLabel: 'supported by', direction: 'OUTGOING', relatedObjectType: 'GovCapability', relatedObjectTypeName: 'Government Capability' }],
}

const CAPABILITY_DEFINITION = {
  objectType: 'GovCapability',
  identityFields: [],
  attributes: [{ code: 'capabilityLevel', name: 'Capability Level', dataType: 'INTEGER', supportedOperators: ['EQUALS', 'GT'] }],
  relationships: [{ relationshipDefId: 'rel-1', forwardLabel: 'supports', reverseLabel: 'supported by', direction: 'INCOMING', relatedObjectType: 'Application', relatedObjectTypeName: 'Application' }],
}

function makeApi(definitions: Record<string, any>) {
  return {
    get: jest.fn((path: string) => {
      const match = path.match(/objectType=([^&]+)/)
      const type = match ? decodeURIComponent(match[1]) : ''
      if (definitions[type]) return Promise.resolve(definitions[type])
      return Promise.reject(new Error('not found'))
    }),
  }
}

function setup(overrides: Partial<{ objectType: string; api: any; value: ConditionGroup | null }> = {}) {
  const onChange = jest.fn()
  const onApply = jest.fn()
  const onClear = jest.fn()
  const api = overrides.api ?? makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_DEFINITION })
  const utils = render(
    <DynamicFilterBuilder objectType={overrides.objectType ?? 'Application'} api={api} value={overrides.value ?? null} onChange={onChange} onApply={onApply} onClear={onClear} />,
  )
  return { ...utils, onChange, onApply, onClear, api }
}

describe('DynamicFilterBuilder', () => {
  it('discovers the filter definition for the given object type on mount', async () => {
    const { api } = setup()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/architecture-query/filter-definition?objectType=Application'))
  })

  it('renders no UI at all when no object type is selected', () => {
    const { container } = setup({ objectType: '' })
    expect(container.firstChild).toBeNull()
  })

  it('object-type-specific attributes: shows Application attributes, not Capability ones', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: '' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Technology Stack')).toBeInTheDocument())
    expect(screen.queryByText('Capability Level')).not.toBeInTheDocument()
  })

  it('a different object type shows its own, different attributes', async () => {
    const api = makeApi({ GovCapability: CAPABILITY_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'capabilityLevel', operator: 'EQUALS', value: '' }] }
    render(<DynamicFilterBuilder objectType="GovCapability" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Capability Level')).toBeInTheDocument())
    expect(screen.queryByText('Technology Stack')).not.toBeInTheDocument()
  })

  it('datatype-specific operators: only shows operators declared for the selected attribute, not a universal list', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: '' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Technology Stack')).toBeInTheDocument())
    const operatorSelects = screen.getAllByRole('combobox')
    const operatorSelect = operatorSelects[1] // [0]=field, [1]=operator
    const options = Array.from((operatorSelect as HTMLSelectElement).options).map(o => o.value)
    expect(options).toEqual(['EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'])
    expect(options).not.toContain('GT') // not a valid TEXT operator
  })

  it('string input: renders a text input for a TEXT attribute', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: '' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(document.querySelector('input[type="text"]')).toBeInTheDocument())
  })

  it('enum input: renders a select with the Meta Model enum values, not free text', async () => {
    const onChange = jest.fn()
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'businessCriticality', operator: 'IS', value: '' }] }} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('High')).toBeInTheDocument())
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('boolean input: TRUE/FALSE operators need no value input at all', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'isActive', operator: 'TRUE' }] }} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Is Active')).toBeInTheDocument())
    expect(document.querySelector('input[type="text"], input[type="number"]')).not.toBeInTheDocument()
  })

  it('number input: renders a numeric input for an INTEGER attribute', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'userCount', operator: 'GT', value: 10 }] }} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(document.querySelector('input[type="number"]')).toBeInTheDocument())
  })

  it('date input: renders a date input for a DATE attribute', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'launchDate', operator: 'BEFORE', value: '' }] }} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(document.querySelector('input[type="date"]')).toBeInTheDocument())
  })

  it('missing/present operators: IS_EMPTY/IS_NOT_EMPTY are offered and need no value input', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'IS_EMPTY' }] }} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('has no value')).toBeInTheDocument())
    expect(document.querySelector('input[type="text"]')).not.toBeInTheDocument()
  })

  it('Add Condition: clicking it adds a new attribute condition to the group (identity fields first, then attributes)', async () => {
    const { onChange } = setup()
    fireEvent.click(await screen.findByText('+ Add condition'))
    expect(onChange).toHaveBeenCalledWith({ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: '' }] })
  })


  it('Remove Condition: clicking × removes just that condition; removing the last one clears the whole group (null)', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const onChange = jest.fn()
    render(<DynamicFilterBuilder objectType="Application" api={api} value={{ operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: 'x' }] }} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Technology Stack')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Remove'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('AND: the group operator toggle defaults to AND and combines multiple top-level conditions', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: 'a' }, { type: 'ATTRIBUTE', attributeCode: 'userCount', operator: 'GT', value: 1 }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getAllByText('AND').length).toBeGreaterThan(0))
  })

  it('OR: clicking OR on the top-level toggle switches the group operator', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const onChange = jest.fn()
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: 'a' }, { type: 'ATTRIBUTE', attributeCode: 'userCount', operator: 'GT', value: 1 }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getAllByText('OR').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('OR')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ operator: 'OR' }))
  })

  it('Add Group: adds a nested group with its own 2 conditions and its own AND/OR toggle', async () => {
    const { onChange } = setup()
    fireEvent.click(await screen.findByText('+ Add group'))
    expect(onChange).toHaveBeenCalledWith({
      operator: 'AND',
      conditions: [{ operator: 'OR', conditions: [
        { type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: '' },
        { type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: '' },
      ] }],
    })
  })

  it('nested A AND (B OR C): renders the top-level condition and the nested group with a visually distinct box and its own toggle', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = {
      operator: 'AND',
      conditions: [
        { type: 'ATTRIBUTE', attributeCode: 'businessCriticality', operator: 'IS', value: 'high' },
        { operator: 'OR', conditions: [
          { type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: 'ACTIVE' },
          { type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: 'PLANNED' },
        ] },
      ],
    }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Group')).toBeInTheDocument())
    // getAllByDisplayValue matches only the SELECTED <option> in each
    // <select> (not every <option>, which getAllByText would match across
    // all 3 field-selector dropdowns on screen) - proves exactly 2 field
    // selectors are actually set to "Status", matching the 2 conditions
    // inside the nested group.
    expect(screen.getAllByDisplayValue('Status')).toHaveLength(2)
  })

  it('nested group does not corrupt to (A AND B) OR C - the group node retains its own operator independent of the parent', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const onChange = jest.fn()
    const value: ConditionGroup = {
      operator: 'AND',
      conditions: [
        { type: 'ATTRIBUTE', attributeCode: 'businessCriticality', operator: 'IS', value: 'high' },
        { operator: 'OR', conditions: [{ type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: 'ACTIVE' }, { type: 'ATTRIBUTE', attributeCode: '__status', operator: 'IS', value: 'PLANNED' }] },
      ],
    }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Group')).toBeInTheDocument())
    // Changing the nested group's own AND/OR does not touch the parent's operator
    const groupBox = screen.getByText('Group').closest('div')!.parentElement!
    const andButtons = Array.from(groupBox.querySelectorAll('button')).filter(b => b.textContent === 'AND')
    fireEvent.click(andButtons[0])
    const [updatedGroup] = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(updatedGroup.operator).toBe('AND') // parent unaffected
    expect(updatedGroup.conditions[1].operator).toBe('AND') // only the nested group changed
  })

  it('relationship EXISTS: "Has" is the default relationship operator', async () => {
    const { onChange } = setup()
    fireEvent.click(await screen.findByText('+ Add relationship'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ conditions: [expect.objectContaining({ operator: 'EXISTS' })] }))
  })

  it('relationship NOT_EXISTS: selecting "Does not have" sets NOT_EXISTS', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const onChange = jest.fn()
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Has')).toBeInTheDocument())
    fireEvent.change(screen.getByDisplayValue('Has'), { target: { value: 'NOT_EXISTS' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ conditions: [expect.objectContaining({ operator: 'NOT_EXISTS' })] }))
  })

  // Requirement (explicit correction from live testing): a many-to-many/
  // one-to-many relationship's related-object Name condition must allow
  // picking several related assets ("is any of [A, B, C]"), not just one.
  it('related-object Name field with IN operator renders a multi-select chip autocomplete, not a single text box', async () => {
    const CAPABILITY_WITH_NAME = { ...CAPABILITY_DEFINITION, identityFields: [{ code: '__name', name: 'Name', dataType: 'TEXT', supportedOperators: ['EQUALS', 'CONTAINS', 'IN', 'NOT_IN'] }] }
    const api = makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_WITH_NAME })
    const onChange = jest.fn()
    const value: ConditionGroup = {
      operator: 'AND',
      conditions: [{
        type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS',
        relatedConditions: { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: '__name', operator: 'IN', value: ['Payments API'] }] },
      }],
    }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    // The already-selected chip renders
    await waitFor(() => expect(screen.getByText('Payments API')).toBeInTheDocument())
    // A remove (×) control exists for the chip - proves this is the
    // multi-select chip UI, not a plain text input showing the raw array
    expect(screen.getByLabelText('Remove Payments API')).toBeInTheDocument()
  })

  it('selecting a search result while IN is active adds it as an additional chip, not replacing the existing selection', async () => {
    const CAPABILITY_WITH_NAME = { ...CAPABILITY_DEFINITION, identityFields: [{ code: '__name', name: 'Name', dataType: 'TEXT', supportedOperators: ['EQUALS', 'CONTAINS', 'IN', 'NOT_IN'] }] }
    const capabilitySearchApi = jest.fn().mockResolvedValue({ items: [{ name: 'Onboarding API' }] })
    const api = { get: (path: string) => {
      if (path.includes('/ea-repository/assets')) return capabilitySearchApi(path)
      const match = path.match(/objectType=([^&]+)/)
      const defs: Record<string, any> = { Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_WITH_NAME }
      return Promise.resolve(defs[match ? decodeURIComponent(match[1]) : ''])
    } }
    const onChange = jest.fn()
    const value: ConditionGroup = {
      operator: 'AND',
      conditions: [{
        type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS',
        relatedConditions: { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: '__name', operator: 'IN', value: ['Payments API'] }] },
      }],
    }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Payments API')).toBeInTheDocument())
    const searchInput = screen.getByLabelText('Search by name…')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'Onboard' } })
    const option = await screen.findByText('Onboarding API')
    fireEvent.mouseDown(option)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      conditions: [expect.objectContaining({ relatedConditions: { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: '__name', operator: 'IN', value: ['Payments API', 'Onboarding API'] }] } })],
    }))
  })

  it('forward relationship presentation: shows the forward label and related type name for an OUTGOING relationship', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText(/supports Government Capability/)).toBeInTheDocument())
  })

  it('reverse relationship presentation: shows the reverse label for an INCOMING relationship (from the Capability side)', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'INCOMING', operator: 'EXISTS' }] }
    render(<DynamicFilterBuilder objectType="GovCapability" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText(/supported by Application/)).toBeInTheDocument())
  })

  it('related-object condition: "Condition on <RelatedType>" button adds a one-hop related condition', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_DEFINITION })
    const onChange = jest.fn()
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    const button = await screen.findByText('+ Condition on Government Capability')
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      conditions: [expect.objectContaining({ relatedConditions: { operator: 'AND', conditions: [] } })],
    }))
  })

  it('related-object attribute list comes from the RELATED type\'s own Meta Model definition, not the root\'s', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_DEFINITION })
    const value: ConditionGroup = {
      operator: 'AND',
      conditions: [{
        type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS',
        // A related condition already present (rather than clicking "+
        // Condition" with a no-op onChange, which would never actually
        // update this fully-controlled component's rendered value).
        relatedConditions: { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'capabilityLevel', operator: 'EQUALS', value: '' }] },
      }],
    }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/architecture-query/filter-definition?objectType=GovCapability'))
    // Capability Level (from GovCapability's definition) appears as the
    // related condition's field - not Application's own attributes.
    await waitFor(() => expect(screen.getByText('Capability Level')).toBeInTheDocument())
  })

  it('object type change resets an incompatible query: an attribute not valid on the new type is removed, not silently kept', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION, GovCapability: CAPABILITY_DEFINITION })
    const onChange = jest.fn()
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: 'x' }] }
    // Simulates the parent page switching root object type - technologyStack
    // does not exist on GovCapability.
    render(<DynamicFilterBuilder objectType="GovCapability" api={api} value={value} onChange={onChange} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null)) // the only condition was invalid - whole query cleared
  })

  it('Clear: clicking Clear invokes onClear', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const { onClear } = setup({ api, value: { operator: 'AND', conditions: [{ type: 'ATTRIBUTE', attributeCode: 'technologyStack', operator: 'CONTAINS', value: 'x' }] } })
    await waitFor(() => expect(screen.getByText('Clear')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalled()
  })

  it('invalid/stale definition handling: shows a clear error message when discovery fails, rather than a blank or broken UI', async () => {
    const api = { get: jest.fn().mockRejectedValue(new Error('network error')) }
    setup({ api })
    await waitFor(() => expect(screen.getByText('Could not load available filters for this object type.')).toBeInTheDocument())
  })

  it('no internal IDs/JSON exposed: relationshipDefId and raw attribute codes never appear as visible text', async () => {
    const api = makeApi({ Application: APPLICATION_DEFINITION })
    const value: ConditionGroup = { operator: 'AND', conditions: [{ type: 'RELATIONSHIP', relationshipDefId: 'rel-1', direction: 'OUTGOING', operator: 'EXISTS' }] }
    render(<DynamicFilterBuilder objectType="Application" api={api} value={value} onChange={jest.fn()} onApply={jest.fn()} onClear={jest.fn()} />)
    await waitFor(() => expect(screen.getByText(/supports Government Capability/)).toBeInTheDocument())
    expect(screen.queryByText('rel-1')).not.toBeInTheDocument()
    expect(screen.queryByText('technologyStack')).not.toBeInTheDocument() // raw code, not the display name
  })
})
