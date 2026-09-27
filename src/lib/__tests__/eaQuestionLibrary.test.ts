import { EA_QUESTION_LIBRARY, ALL_EA_QUESTIONS, FEATURED_EA_QUESTIONS } from '../eaQuestionLibrary';

// The approved list, verbatim, in its approved numbering and categories.
const APPROVED: Array<[string, number[], string[]]> = [
  ['Transparency', [1, 12], [
    'What is our application portfolio?', 'What is our technical debt?', 'Who are our vendors?', 'What are our architectural dependencies?',
    'Which process areas require the most IT support?', 'What are our middleware integrations?', 'Where are our applications deployed?',
    'What is our service catalog?', 'What is our Technology Portfolio?', 'Which contracts should we review?', 'What is our data landscape?',
    'What is our enterprise resource model?',
  ]],
  ['Governance', [13, 17], [
    'Who is responsible for our assets?', 'Who owns which applications?', 'What is our standards catalog?', 'What should we be focusing on?',
    'Who owns our technologies?',
  ]],
  ['Rationalization', [18, 21], [
    'What are our investment / retirement candidates?', 'What is the status of our rationalization plan?',
    'Where do we have functional redundancies?', 'What are our service overlaps?',
  ]],
  ['Roadmapping', [22, 28], [
    'What is our application roadmap?', 'What is our application landscape?', 'What is our target architecture?', 'What is our vendor roadmap?',
    'What is our service roadmap?', 'What is our service landscape?', 'What is our technology roadmap?',
  ]],
  ['Transformation', [29, 34], [
    'What are our most important projects?', 'What is the status of our project portfolio?', 'What are our project overlaps?',
    'Where are our project dependencies?', 'Where can we expect resource constraints?', 'How are we progressing with our strategy?',
  ]],
  ['Business Relationship', [35, 41], [
    'What is our demand pipeline?', 'Which demands should be realized?', 'What is our business-IT alignment?', 'Where are our applications used?',
    'What is our technology usage?', 'Where are our business priorities?', 'Who are our service providers and consumers?',
  ]],
  ['Finance', [42, 45], ['What is our OPEX distribution?', 'What is our CAPEX distribution?', 'What are our cost drivers?', 'What are our service costs?']],
  ['Cloud Migration', [46, 47], ['What are our cloud focus areas?', 'What is our cloud migration strategy?']],
  ['Risk', [48, 53], [
    'How will IT failure impact our business?', 'What is our security score?', 'Where do we have SLA violations?', 'Where do we use sensitive data?',
    'Where do we have technology risk?', 'Where is our data processed?',
  ]],
];

describe('EA question library', () => {
  it('holds exactly the 53 approved questions', () => {
    expect(ALL_EA_QUESTIONS).toHaveLength(53);
    expect(ALL_EA_QUESTIONS.map(q => q.text)).toEqual(APPROVED.flatMap(([, , questions]) => questions));
  });

  it('has the 9 approved categories, in order', () => {
    expect(EA_QUESTION_LIBRARY.map(c => c.label)).toEqual(APPROVED.map(([label]) => label));
  });

  it.each(APPROVED)('%s holds its approved questions with their approved numbers', (label, [from, to], questions) => {
    const category = EA_QUESTION_LIBRARY.find(c => c.label === label)!;
    expect(category.questions.map(q => q.text)).toEqual(questions);
    const ids = Array.from({ length: to - from + 1 }, (_, i) => `ea-q${String(from + i).padStart(2, '0')}`);
    expect(category.questions.map(q => q.id)).toEqual(ids);
  });

  it('has unique ids, texts and category ids', () => {
    expect(new Set(ALL_EA_QUESTIONS.map(q => q.id)).size).toBe(53);
    expect(new Set(ALL_EA_QUESTIONS.map(q => q.text)).size).toBe(53);
    expect(new Set(EA_QUESTION_LIBRARY.map(c => c.id)).size).toBe(9);
  });

  it('features a small opening set drawn from the library, across different categories', () => {
    expect(FEATURED_EA_QUESTIONS.length).toBeGreaterThanOrEqual(4);
    expect(FEATURED_EA_QUESTIONS.length).toBeLessThanOrEqual(5);
    for (const featured of FEATURED_EA_QUESTIONS) expect(ALL_EA_QUESTIONS).toContainEqual(featured);
    const categories = FEATURED_EA_QUESTIONS.map(f => EA_QUESTION_LIBRARY.find(c => c.questions.some(q => q.id === f.id))!.id);
    expect(new Set(categories).size).toBe(FEATURED_EA_QUESTIONS.length);
  });
});
