import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ROLE_UPDATE_TRANSLATIONS } from '../roleUpdateStrings'

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)

import RoleTemplateUpdates from '../RoleTemplateUpdates'

const plan = { items: [
  { code: 'ea-viewer', name: 'EA Viewer', action: 'ADD', permissions: ['FinancialValue.View'], users: 4 },
  { code: 'financial-controller', name: 'Financial Controller', action: 'CREATE', permissions: ['FinancialValue.ValidateData'], users: 0 },
] }

describe('RoleTemplateUpdates', () => {
  it('lists what each built-in role would gain and applies only the chosen roles', async () => {
    const api = { get: jest.fn(async () => plan), post: jest.fn(async () => ({ applied: [{ code: 'ea-viewer' }] })) }
    const onApplied = jest.fn()
    render(<RoleTemplateUpdates api={api} onApplied={onApplied} />)
    expect(await screen.findByText('EA Viewer')).toBeInTheDocument()
    expect(screen.getByText('FinancialValue.View')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Financial Controller/))
    fireEvent.click(screen.getByText('ag.tpl.apply'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/access-governance/role-templates/updates', { roleCodes: ['ea-viewer'] }))
    expect(onApplied).toHaveBeenCalled()
  })

  it('shows nothing when the built-in roles are up to date or the user may not see the plan', async () => {
    const api = { get: jest.fn(async () => ({ statusCode: 403 })), post: jest.fn() }
    const { container } = render(<RoleTemplateUpdates api={api} onApplied={() => undefined} />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('has EN and Arabic text for every key', () => {
    for (const v of Object.values(ROLE_UPDATE_TRANSLATIONS)) { expect(v.EN.trim()).toBeTruthy(); expect(/[؀-ۿ]/.test(v.AR)).toBe(true) }
  })
})
