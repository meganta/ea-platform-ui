import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import VersionBar from '../VersionBar';
import ReleasePanel from '../ReleasePanel';
import DeleteImpactDialog from '../DeleteImpactDialog';
import OrphanedLinksCard from '../OrphanedLinksCard';
import { ReleaseContext, releaseState, MetaModelVersion } from '../release';
import { METAMODEL_TRANSLATIONS } from '../metaModelStrings';

let mockAdmin = true;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 't', hasPermission: () => mockAdmin }),
}));
jest.mock('../../../contexts/LangContext', () => {
  const { METAMODEL_TRANSLATIONS: S } = jest.requireActual('../metaModelStrings');
  return { useLang: () => ({ t: (k: string) => S[k]?.EN ?? k, isAR: false }) };
});

const DRAFT: MetaModelVersion = { id: 'v2', version: 'draft-2', status: 'DRAFT', description: 'Tidy relationships' };
const PUB: MetaModelVersion = { id: 'v1', version: '2026.09', status: 'PUBLISHED', publishedAt: '2026-09-01T00:00:00Z' };

const IMPACT = {
  version: { id: 'v2', version: 'draft-2', status: 'DRAFT' },
  basedOn: { id: 'v1', version: '2026.09' },
  summary: { total: 2, breaking: 1, potentiallyBreaking: 0, nonBreaking: 1, requiresAcknowledgement: true },
  changes: [
    { key: 'RELATIONSHIP:APP_RUNS_ON_SERVER', kind: 'RELATIONSHIP', action: 'REMOVED', code: 'APP_RUNS_ON_SERVER', name: 'Runs on', fields: [],
      impact: { severity: 'BREAKING', objects: 0, links: 40, values: 0, views: [{ id: 'vw', name: 'Hosting view' }], referenceElements: [], consequences: ['40 Repository links use this relationship.'] } },
    { key: 'DOMAIN:DATA', kind: 'DOMAIN', action: 'ADDED', code: 'DATA', name: 'Data', fields: [],
      impact: { severity: 'NON_BREAKING', objects: 0, links: 0, values: 0, views: [], referenceElements: [], consequences: ['New; nothing existing changes.'] } },
  ],
};

function makeApi(over: Record<string, any> = {}) {
  return {
    get: jest.fn((path: string) => Promise.resolve(path in over ? over[path] : IMPACT)),
    post: jest.fn(() => Promise.resolve({})),
    put: jest.fn(),
    del: jest.fn(() => Promise.resolve({})),
  };
}

function withRelease(ui: React.ReactElement, versions: MetaModelVersion[], reload = jest.fn()) {
  return <ReleaseContext.Provider value={releaseState(versions, reload)}>{ui}</ReleaseContext.Provider>;
}

beforeEach(() => { mockAdmin = true; jest.restoreAllMocks(); });

describe('VersionBar', () => {
  it('shows the open draft, what it is based on and how many changes need attention', async () => {
    const api = makeApi();
    render(withRelease(<VersionBar api={api} onOpenRelease={jest.fn()} />, [DRAFT, PUB]));
    expect(screen.getByText('Editing draft draft-2')).toBeInTheDocument();
    expect(screen.getByText('based on published 2026.09')).toBeInTheDocument();
    expect(await screen.findByText('1 need attention')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/meta-model/versions/v2/impact');
  });

  it('says the published version is read-only and offers to start a draft', () => {
    const open = jest.fn();
    render(withRelease(<VersionBar api={makeApi()} onOpenRelease={open} />, [PUB]));
    expect(screen.getByText('Viewing published 2026.09 — read-only')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Start a new draft'));
    expect(open).toHaveBeenCalled();
  });
});

describe('ReleasePanel', () => {
  it('creates a draft from the published version', async () => {
    const api = makeApi();
    const reload = jest.fn();
    render(withRelease(<ReleasePanel api={api} />, [PUB], reload));
    fireEvent.change(screen.getByLabelText('Version name'), { target: { value: '2026.10' } });
    fireEvent.change(screen.getByLabelText('What this version changes'), { target: { value: 'Licences' } });
    fireEvent.click(screen.getByText('Create draft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/meta-model/versions', { version: '2026.10', description: 'Licences' }));
    expect(reload).toHaveBeenCalled();
  });

  it('lists the draft changes with their impact and needs an acknowledgement before publishing breaking changes', async () => {
    const api = makeApi();
    render(withRelease(<ReleasePanel api={api} />, [DRAFT, PUB]));
    expect(await screen.findByText('40 Repository links use this relationship.')).toBeInTheDocument();
    expect(screen.getByText(/Hosting view/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mm-change')).toHaveLength(2);
    fireEvent.click(screen.getByText('Needing attention'));
    expect(screen.getAllByTestId('mm-change')).toHaveLength(1);

    const publish = screen.getByText('Publish draft');
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByTestId('mm-ack'));
    expect(publish).not.toBeDisabled();
    fireEvent.click(publish);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/meta-model/versions/v2/publish', { acknowledge: true }));
    expect(await screen.findByText('Version draft-2 is published and now in use.')).toBeInTheDocument();
  });

  it('discards the draft after confirmation', async () => {
    const api = makeApi();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(withRelease(<ReleasePanel api={api} />, [DRAFT, PUB]));
    await screen.findByText('40 Repository links use this relationship.');
    fireEvent.click(screen.getByText('Discard draft'));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/meta-model/versions/v2'));
  });

  it('shows the error the API returns (e.g. a second draft) instead of failing silently', async () => {
    const api = makeApi();
    api.post.mockImplementationOnce(() => Promise.reject(new Error("Draft 'x' is already open.")));
    render(withRelease(<ReleasePanel api={api} />, [PUB]));
    fireEvent.change(screen.getByLabelText('Version name'), { target: { value: 'x2' } });
    fireEvent.click(screen.getByText('Create draft'));
    expect(await screen.findByText("Draft 'x' is already open.")).toBeInTheDocument();
  });

  it('only administrators can create, publish or discard', () => {
    mockAdmin = false;
    render(withRelease(<ReleasePanel api={makeApi()} />, [PUB]));
    expect(screen.getByText('Only tenant administrators can create, publish or discard versions.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Version name'), { target: { value: 'x' } });
    expect(screen.getByText('Create draft')).toBeDisabled();
  });

  it('shows the version history with statuses', () => {
    render(withRelease(<ReleasePanel api={makeApi()} />, [PUB, { id: 'v0', version: '2026.01', status: 'DEPRECATED' }]));
    expect(screen.getByText('2026.01')).toBeInTheDocument();
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
  });
});

describe('DeleteImpactDialog', () => {
  const RELATIONSHIP_USAGE = {
    kind: 'RELATIONSHIP', item: { id: 'r1', code: 'APP_RUNS_ON_SERVER', name: 'Runs on' }, version: { id: 'v2', version: 'draft-2', status: 'DRAFT' },
    editable: true, canDelete: true, blocked: null, warning: 'This relationship comes from the framework.',
    impact: { severity: 'BREAKING', objects: 0, links: 40, values: 0, views: [], referenceElements: [], consequences: ['40 Repository links would no longer match.'] },
    sampleLinks: [{ id: 'l1', source: 'HR App', target: 'SRV-01' }],
  };

  it('traces where the item is used and deletes only after the impact is acknowledged', async () => {
    const api = makeApi({ '/meta-model/where-used/relationship/r1': RELATIONSHIP_USAGE });
    const onDeleted = jest.fn();
    render(<DeleteImpactDialog api={api} kind="relationship" id="r1" name="Runs on" onClose={jest.fn()} onDeleted={onDeleted} />);
    expect(await screen.findByText('40 Repository links would no longer match.')).toBeInTheDocument();
    expect(screen.getByText('HR App → SRV-01')).toBeInTheDocument();
    expect(screen.getByText('…and 39 more')).toBeInTheDocument();
    expect(screen.getByText('This relationship comes from the framework.')).toBeInTheDocument();
    const confirm = screen.getByText('Delete from draft');
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByTestId('mm-del-ack'));
    fireEvent.click(confirm);
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/meta-model/relationships/r1'));
    expect(onDeleted).toHaveBeenCalled();
  });

  it('explains a blocked delete and offers no delete button', async () => {
    const api = makeApi({ '/meta-model/where-used/object-type/o1': {
      ...RELATIONSHIP_USAGE, kind: 'OBJECT_TYPE', canDelete: false, warning: null,
      blocked: '4 Repository object(s) of this type exist.',
      impact: { ...RELATIONSHIP_USAGE.impact, links: 0, objects: 4 },
      sampleLinks: [], sampleObjects: [{ id: 'a1', name: 'SRV-01' }],
      relationships: [{ id: 'r1', code: 'X', name: 'Runs on', label: 'runs on', from: 'Application', to: 'Server', links: 40 }],
    } });
    render(<DeleteImpactDialog api={api} kind="object-type" id="o1" name="Server" onClose={jest.fn()} onDeleted={jest.fn()} />);
    expect(await screen.findByTestId('mm-del-blocked')).toHaveTextContent('4 Repository object(s) of this type exist.');
    expect(screen.getByText('SRV-01')).toBeInTheDocument();
    expect(screen.getByText('Application → runs on → Server (40 links)')).toBeInTheDocument();
    expect(screen.queryByText('Delete from draft')).not.toBeInTheDocument();
  });

  it('shows the API error when deleting fails', async () => {
    const api = makeApi({ '/meta-model/where-used/attribute/a1': { ...RELATIONSHIP_USAGE, kind: 'ATTRIBUTE', warning: null, impact: { ...RELATIONSHIP_USAGE.impact, severity: 'NON_BREAKING' } } });
    api.del.mockImplementationOnce(() => Promise.reject(new Error('Version is published')));
    render(<DeleteImpactDialog api={api} kind="attribute" id="a1" name="Vendor" onClose={jest.fn()} onDeleted={jest.fn()} />);
    fireEvent.click(await screen.findByText('Delete from draft'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Version is published');
  });
});

describe('OrphanedLinksCard', () => {
  const REPORT = {
    orphaned: {
      total: 112, reconnectable: 109,
      groups: [
        { definitionCode: 'APP_SUPPORTS_CAPABILITY', name: 'Application supports Capability', sourceType: 'Application', targetType: 'GovCapability', label: 'supports', count: 109, reconnectTo: { id: 'd-new', code: 'Application-supports-Capability', name: 'Application supports Capability' } },
        { definitionCode: 'APP_EXPOSES_API', name: 'Application exposes API', sourceType: 'Application', targetType: 'API', label: 'exposes', count: 3, reconnectTo: null },
      ],
    },
    duplicates: { rowsToRemove: 4 },
  };
  const ANALYZE = '/ea-repository/relationship-integrity/analyze';

  it('lists links whose relationship was removed and which ones the published Meta Model reconnects', async () => {
    const api = makeApi({ [ANALYZE]: REPORT });
    render(<OrphanedLinksCard api={api} />);
    expect(await screen.findByText('112 links have no relationship in the published Meta Model; 109 can be reconnected now.')).toBeInTheDocument();
    expect(screen.getByText('Reconnects to: Application supports Capability (Application-supports-Capability)')).toBeInTheDocument();
    expect(screen.getByText(/Not in the published Meta Model/)).toBeInTheDocument();
  });

  it('reconnects only (never links other rows) and removes duplicates only when asked', async () => {
    const api = makeApi({ [ANALYZE]: REPORT });
    api.post.mockResolvedValue({ reconnected: 109, removed: 4 } as any);
    render(<OrphanedLinksCard api={api} />);
    fireEvent.click(await screen.findByTestId('mm-orph-dups'));
    fireEvent.click(screen.getByText('Reconnect 109 links'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ea-repository/relationship-integrity/apply', { linkUnlinked: false, removeDuplicates: true }));
    expect(await screen.findByText('109 links reconnected; 4 duplicates removed.')).toBeInTheDocument();
  });

  it('shows nothing when no link lost its relationship', async () => {
    const api = makeApi({ [ANALYZE]: { orphaned: { total: 0, reconnectable: 0, groups: [] }, duplicates: { rowsToRemove: 0 } } });
    const { container } = render(<OrphanedLinksCard api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Meta Model release strings', () => {
  it('every string has English and Arabic text', () => {
    for (const [key, v] of Object.entries(METAMODEL_TRANSLATIONS)) {
      expect(v.EN.trim()).not.toBe('');
      expect(v.AR.trim()).not.toBe('');
      expect(/[؀-ۿ]/.test(v.AR)).toBe(true);
      expect(key.startsWith('mm.')).toBe(true);
    }
  });

  it('every static mm.* key used by the studio exists, and every dynamic family is complete', () => {
    const dir = join(__dirname, '..');
    const files = [...readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => join(dir, f)), join(dir, '..', 'MetaModelPage.tsx')];
    const used = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/t\('(mm\.[\w.]+)'\)/g)) used.add(m[1]);
    for (const k of used) expect(METAMODEL_TRANSLATIONS[k]).toBeDefined();
    const families: Record<string, string[]> = {
      'mm.rel.sev.': ['BREAKING', 'POTENTIALLY_BREAKING', 'NON_BREAKING'],
      'mm.rel.kind.': ['DOMAIN', 'OBJECT_TYPE', 'ATTRIBUTE', 'RELATIONSHIP'],
      'mm.rel.action.': ['ADDED', 'REMOVED', 'MODIFIED'],
      'mm.rel.status.': ['DRAFT', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED'],
      'mm.rel.step.': ['draft', 'review', 'publish'],
      'mm.rel.filter.': ['all', 'attention'],
    };
    for (const [prefix, keys] of Object.entries(families)) for (const k of keys) expect(METAMODEL_TRANSLATIONS[prefix + k]).toBeDefined();
  });
});
