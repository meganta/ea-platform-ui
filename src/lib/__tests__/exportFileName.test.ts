import { cleanFileTitle, exportFileName } from '../exportFileName';

describe('exportFileName', () => {
  it('names the file after the review or study title and the export language', () => {
    expect(exportFileName('JME revision again', 'Governance_Review', 'en', 'pptx')).toBe('JME_revision_again_EN.pptx');
    expect(exportFileName('HLD - Job Matching Engine 2.0', 'Governance_Review', 'ar', '.docx')).toBe('HLD_-_Job_Matching_Engine_2.0_AR.docx');
  });

  it('keeps Arabic titles readable', () => {
    expect(exportFileName('دراسة الاختبار المدعوم بالذكاء الاصطناعي', 'Innovation_Study', 'ar', 'pptx')).toBe('دراسة_الاختبار_المدعوم_بالذكاء_الاصطناعي_AR.pptx');
  });

  it('removes characters no file system accepts and falls back when nothing is left', () => {
    expect(cleanFileTitle('Review: A/B "test" <v2>?')).toBe('Review_A_B_test_v2');
    expect(exportFileName('  ::  ', 'Innovation_Study', 'en', 'docx')).toBe('Innovation_Study_EN.docx');
    expect(exportFileName(null, 'Governance_Review', 'en', 'pptx')).toBe('Governance_Review_EN.pptx');
  });

  it('caps very long titles', () => {
    expect(Array.from(cleanFileTitle('a'.repeat(300)))).toHaveLength(120);
  });
});
