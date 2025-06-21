/**
 * Berekent het totale aantal pagina's dat voor één respondent wordt gereserveerd.
 * Dit omvat een brief, een blanco pagina, de enquêtepagina's en een optionele extra blanco pagina
 * om ervoor te zorgen dat het totaal een even getal is (voor correct dubbelzijdig afdrukken).
 * @param pagesPerQuestionnaire Het aantal enquêtepagina's voor de respondent.
 * @returns Het totale aantal pagina's in het blok voor de respondent.
 */
export function getPagesPerRespondentBlock(pagesPerQuestionnaire: number): number {
  // 1 briefpagina + 1 blanco pagina + N enquêtepagina's
  let total = 2 + pagesPerQuestionnaire;
  // Voeg een blanco pagina toe als het totaal oneven is
  if (total % 2 !== 0) {
    total++;
  }
  return total;
}

/**
 * Berekent de 0-gebaseerde paginaindices die geannoteerd moeten worden voor een specifieke respondent binnen een PDF.
 * @param respondentIndexInPdf De 0-gebaseerde index van de respondent binnen het PDF-bestand.
 * @param pagesPerQuestionnaire Het aantal enquêtepagina's per respondent.
 * @returns Een array van 0-gebaseerde paginaindices die geannoteerd moeten worden.
 */
export function calculateAnnotationPages(respondentIndexInPdf: number, pagesPerQuestionnaire: number): number[] {
  const pagesPerBlock = getPagesPerRespondentBlock(pagesPerQuestionnaire);
  const startPageOfBlock = respondentIndexInPdf * pagesPerBlock;
  
  // De annotaties beginnen na de briefpagina en de eerste blanco pagina.
  const firstAnnotationPage = startPageOfBlock + 2;
  
  const pagesToAnnotate = Array.from(
    { length: pagesPerQuestionnaire },
    (_, i) => firstAnnotationPage + i
  );

  console.log(`[DEBUG] Respondent ${respondentIndexInPdf}:`);
  console.log(`  - Pages per block: ${pagesPerBlock}`);
  console.log(`  - Block starts at page index: ${startPageOfBlock}`);
  console.log(`  - Annotating ${pagesToAnnotate.length} pages: [${pagesToAnnotate.join(', ')}]`);

  return pagesToAnnotate;
} 