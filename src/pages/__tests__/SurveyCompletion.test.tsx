import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MySurveysPage from '../MySurveysPage';

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockIsAR, t: (k: string) => k }) }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'u' } }) }));

let calls: { path: string; method: string; body: any }[];
let failSave: boolean;
let saved: any[];
const question = { id: 'q1', sectionId: 's1', text: 'Process documented?', type: 'YES_NO', required: true, evidenceRequirement: 'OPTIONAL' };
function setup(extra: any = {}) {
  calls = []; failSave = false; saved = []; mockIsAR = false;
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn(async (url: any, options: any = {}) => {
    const path = String(url), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, method, body });
    let result: any = {};
    if (path.endsWith('/my/assignments')) result = [{ id: 'a1', survey: { title: 'Maturity survey', status: 'OPEN' } }];
    if (path.endsWith('/my/assignments/a1')) result = { assignment: { status: 'IN_PROGRESS' }, survey: { title: 'Maturity survey', acceptsResponses: true }, sections: [{ id: 's1', title: 'Process' }], questions: [question], responses: saved, evidence: [], ...extra };
    if (path.endsWith('/responses')) {
      if (failSave) return { ok: false, status: 503, json: async () => ({ message: 'Save unavailable' }) } as any;
      saved = body.responses;
    }
    return { ok: true, status: 200, json: async () => result } as any;
  });
}
async function open() { render(<MySurveysPage />); fireEvent.click(await screen.findByText('Maturity survey')); await screen.findByText('Process documented?'); }

it('does not submit when saving changed answers fails; preserves answer and comment for retry', async () => {
  setup(); await open();
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
  fireEvent.change(screen.getByLabelText('Comment / rationale'), { target: { value: 'Procedure approved' } });
  failSave = true;
  fireEvent.click(screen.getByText('Submit'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
  expect(calls.some(c => c.path.endsWith('/submit'))).toBe(false);
  expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
  expect(screen.getByLabelText('Comment / rationale')).toHaveValue('Procedure approved');
  failSave = false;
  fireEvent.click(screen.getByText('Submit'));
  await screen.findByText('Thank you - your answers were submitted.');
  expect(saved[0]).toMatchObject({ value: true, comment: 'Procedure approved' });
  expect(calls.filter(c => c.path.endsWith('/submit'))).toHaveLength(1);
});

it('saves unsaved answers before attaching evidence and retains them after reload', async () => {
  setup(); await open();
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
  fireEvent.click(screen.getByText('+ Add evidence'));
  fireEvent.change(screen.getByLabelText('Evidence type'), { target: { value: 'STATEMENT' } });
  fireEvent.change(screen.getByLabelText('Evidence'), { target: { value: 'Procedure signed by owner' } });
  fireEvent.click(screen.getByText('Attach'));
  await waitFor(() => expect(screen.queryByText('Attach')).not.toBeInTheDocument());
  const writes = calls.filter(c => c.method !== 'GET');
  expect(writes[0].path).toMatch(/responses$/);
  expect(writes[1].path).toMatch(/evidence$/);
  expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
});

it('stays in the same section after a failed save and shows progress for each dimension', async () => {
  setup({ sections: [{ id: 's1', title: 'Process' }, { id: 's2', title: 'People' }], questions: [question, { ...question, id: 'q2', sectionId: 's2', text: 'People trained?' }] });
  await open();
  fireEvent.click(screen.getByRole('radio', { name: 'No' }));
  expect(screen.getByRole('tab', { name: 'Process' })).toHaveTextContent('(1/1)');
  expect(screen.getByRole('tab', { name: 'People' })).toHaveTextContent('(0/1)');
  failSave = true;
  fireEvent.click(screen.getByText('Next'));
  await screen.findByText('Save unavailable');
  expect(screen.getByRole('tab', { name: 'Process' })).toHaveAttribute('aria-selected', 'true');
});

it('returns to unanswered required questions and respects disallowed N/A', async () => {
  setup({ questions: [{ ...question, config: { allowNotApplicable: false } }] }); await open();
  expect(screen.queryByLabelText('Not applicable')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Submit'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Answer the remaining required questions');
  expect(calls.some(c => c.path.endsWith('/submit'))).toBe(false);
});

it('shows evidence and saved rationale on a submitted survey', async () => {
  setup({ survey: { title: 'Maturity survey', acceptsResponses: false }, assignment: { status: 'SUBMITTED' }, responses: [{ questionId: 'q1', value: true, comment: 'Approved procedure' }], evidence: [{ id: 'e1', questionId: 'q1', title: 'Signed procedure', verification: 'VERIFIED' }] });
  await open();
  expect(screen.getByLabelText('Comment / rationale')).toHaveValue('Approved procedure');
  expect(screen.getByLabelText('Comment / rationale')).toBeDisabled();
  expect(screen.getByText(/Signed procedure/)).toBeInTheDocument();
  expect(screen.queryByText('+ Add evidence')).not.toBeInTheDocument();
});

it('shows Arabic completion guidance', async () => {
  setup(); mockIsAR = true; await open();
  expect(screen.getByText(/أسئلة مطلوبة متبقية/)).toBeInTheDocument();
  expect(screen.getByLabelText('تعليق / مبرر')).toBeInTheDocument();
});
