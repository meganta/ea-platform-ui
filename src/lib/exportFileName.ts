/**
 * Download name for an exported governance review or innovation study:
 * the review/study title in the export's language, then the language
 * code — e.g. "JME_2.0_HLD_Review_EN.pptx", "دراسة_الذكاء_الاصطناعي_AR.docx".
 * Characters no file system accepts are removed; Arabic and other scripts
 * are kept as they are.
 */
const MAX_TITLE_CHARS = 120;

export function cleanFileTitle(title: string | null | undefined): string {
  const cleaned = String(title || '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return Array.from(cleaned).slice(0, MAX_TITLE_CHARS).join('').replace(/[._]+$/, '');
}

export function exportFileName(title: string | null | undefined, fallback: string, language: 'en' | 'ar', extension: string): string {
  return `${cleanFileTitle(title) || fallback}_${language.toUpperCase()}.${extension.replace(/^\./, '')}`;
}
