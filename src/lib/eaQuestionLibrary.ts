/**
 * Approved Enterprise Architecture business questions - the Copilot
 * suggested-question library (53 questions in 9 categories).
 *
 * Content only: a question is an entry point into the normal Copilot chat,
 * never special handling. `id` keeps the approved numbering (ea-q01..ea-q53)
 * so a question can be traced back to the approved list.
 */

export interface EaQuestion {
  id: string;
  text: string;
}

export interface EaQuestionCategory {
  id: string;
  label: string;
  questions: EaQuestion[];
}

const q = (n: number, text: string): EaQuestion => ({ id: `ea-q${String(n).padStart(2, '0')}`, text });

export const EA_QUESTION_LIBRARY: EaQuestionCategory[] = [
  {
    id: 'transparency', label: 'Transparency', questions: [
      q(1, 'What is our application portfolio?'),
      q(2, 'What is our technical debt?'),
      q(3, 'Who are our vendors?'),
      q(4, 'What are our architectural dependencies?'),
      q(5, 'Which process areas require the most IT support?'),
      q(6, 'What are our middleware integrations?'),
      q(7, 'Where are our applications deployed?'),
      q(8, 'What is our service catalog?'),
      q(9, 'What is our Technology Portfolio?'),
      q(10, 'Which contracts should we review?'),
      q(11, 'What is our data landscape?'),
      q(12, 'What is our enterprise resource model?'),
    ],
  },
  {
    id: 'governance', label: 'Governance', questions: [
      q(13, 'Who is responsible for our assets?'),
      q(14, 'Who owns which applications?'),
      q(15, 'What is our standards catalog?'),
      q(16, 'What should we be focusing on?'),
      q(17, 'Who owns our technologies?'),
    ],
  },
  {
    id: 'rationalization', label: 'Rationalization', questions: [
      q(18, 'What are our investment / retirement candidates?'),
      q(19, 'What is the status of our rationalization plan?'),
      q(20, 'Where do we have functional redundancies?'),
      q(21, 'What are our service overlaps?'),
    ],
  },
  {
    id: 'roadmapping', label: 'Roadmapping', questions: [
      q(22, 'What is our application roadmap?'),
      q(23, 'What is our application landscape?'),
      q(24, 'What is our target architecture?'),
      q(25, 'What is our vendor roadmap?'),
      q(26, 'What is our service roadmap?'),
      q(27, 'What is our service landscape?'),
      q(28, 'What is our technology roadmap?'),
    ],
  },
  {
    id: 'transformation', label: 'Transformation', questions: [
      q(29, 'What are our most important projects?'),
      q(30, 'What is the status of our project portfolio?'),
      q(31, 'What are our project overlaps?'),
      q(32, 'Where are our project dependencies?'),
      q(33, 'Where can we expect resource constraints?'),
      q(34, 'How are we progressing with our strategy?'),
    ],
  },
  {
    id: 'business-relationship', label: 'Business Relationship', questions: [
      q(35, 'What is our demand pipeline?'),
      q(36, 'Which demands should be realized?'),
      q(37, 'What is our business-IT alignment?'),
      q(38, 'Where are our applications used?'),
      q(39, 'What is our technology usage?'),
      q(40, 'Where are our business priorities?'),
      q(41, 'Who are our service providers and consumers?'),
    ],
  },
  {
    id: 'finance', label: 'Finance', questions: [
      q(42, 'What is our OPEX distribution?'),
      q(43, 'What is our CAPEX distribution?'),
      q(44, 'What are our cost drivers?'),
      q(45, 'What are our service costs?'),
    ],
  },
  {
    id: 'cloud-migration', label: 'Cloud Migration', questions: [
      q(46, 'What are our cloud focus areas?'),
      q(47, 'What is our cloud migration strategy?'),
    ],
  },
  {
    id: 'risk', label: 'Risk', questions: [
      q(48, 'How will IT failure impact our business?'),
      q(49, 'What is our security score?'),
      q(50, 'Where do we have SLA violations?'),
      q(51, 'Where do we use sensitive data?'),
      q(52, 'Where do we have technology risk?'),
      q(53, 'Where is our data processed?'),
    ],
  },
];

export const ALL_EA_QUESTIONS: EaQuestion[] = EA_QUESTION_LIBRARY.flatMap(c => c.questions);

/**
 * The few questions shown when Copilot opens - one each from five different
 * categories, so the first screen stays uncluttered but shows the breadth of
 * the library. Stable (not randomised) so the opening screen is predictable.
 */
export const FEATURED_EA_QUESTION_IDS = ['ea-q01', 'ea-q14', 'ea-q24', 'ea-q30', 'ea-q52'];

export const FEATURED_EA_QUESTIONS: EaQuestion[] = FEATURED_EA_QUESTION_IDS
  .map(id => ALL_EA_QUESTIONS.find(question => question.id === id))
  .filter((question): question is EaQuestion => Boolean(question));
