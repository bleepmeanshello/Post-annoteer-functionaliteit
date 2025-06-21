/**
 * Calculates the total number of pages reserved for one respondent.
 * This includes a cover letter, a blank page, the questionnaire pages, and an optional extra blank page
 * to ensure the total is an even number (for proper double-sided printing).
 * @param pagesPerQuestionnaire The number of questionnaire pages for the respondent.
 * @returns The total number of pages in the respondent's block.
 */
export function getPagesPerRespondentBlock(pagesPerQuestionnaire: number): number {
  // 1 cover letter page + 1 blank page + N questionnaire pages
  let total = 2 + pagesPerQuestionnaire;
  // Add a blank page if the total is odd
  if (total % 2 !== 0) {
    total++;
  }
  return total;
}

/**
 * Calculates the 0-based page indices that should be annotated for a specific respondent within a PDF.
 * @param respondentIndexInPdf The 0-based index of the respondent within the PDF file.
 * @param pagesPerQuestionnaire The number of questionnaire pages per respondent.
 * @returns An array of 0-based page indices that should be annotated.
 */
export function calculateAnnotationPages(respondentIndexInPdf: number, pagesPerQuestionnaire: number): number[] {
  const pagesPerBlock = getPagesPerRespondentBlock(pagesPerQuestionnaire);
  const startPageOfBlock = respondentIndexInPdf * pagesPerBlock;
  
  // Annotations start after the cover letter page and the first blank page.
  const firstAnnotationPage = startPageOfBlock + 2;
  
  const pagesToAnnotate = Array.from(
    { length: pagesPerQuestionnaire },
    (_, i) => firstAnnotationPage + i
  );

  // Consider using a proper logging library with log levels instead of console.log
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] Respondent ${respondentIndexInPdf}:`);
    console.log(`  - Pages per block: ${pagesPerBlock}`);
    console.log(`  - Block starts at page index: ${startPageOfBlock}`);
    console.log(`  - Annotating ${pagesToAnnotate.length} pages: [${pagesToAnnotate.join(', ')}]`);
  }

  return pagesToAnnotate;
} 