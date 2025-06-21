import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { calculateAnnotationPages, getPagesPerRespondentBlock } from './page-calculator';

/**
 * Loads a PDF, adds respondent codes to the specified pages, and returns the modified PDF.
 * 
 * @param pdfBuffer The buffer of the original PDF.
 * @param respondentCodes The codes of the respondents included in this PDF.
 * @param logoUrl The URL of the logo to be embedded.
 * @param pagesPerRespondent The number of questionnaire pages for each respondent.
 * @returns A Promise that resolves to a Uint8Array of the modified PDF.
 */
export async function annotatePdf(
  pdfBuffer: Buffer,
  respondentCodes: string[],
  logoUrl: string,
  pagesPerRespondent: number
): Promise<Uint8Array> {
  console.log(`Annotating PDF for ${respondentCodes.length} respondents.`);
  
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Veiligheidscontrole: controleer of het PDF-document het verwachte aantal pagina's heeft.
  const expectedPages = getPagesPerRespondentBlock(pagesPerRespondent) * respondentCodes.length;
  const actualPages = pdfDoc.getPageCount();
  if (expectedPages !== actualPages) {
    console.warn(
      `Warning: PDF page count mismatch. Expected ${expectedPages} pages based on ` +
      `${respondentCodes.length} respondents with blocks of ${getPagesPerRespondentBlock(pagesPerRespondent)} pages, ` +
      `but document has ${actualPages} pages. Annotation will proceed but might be incorrect.`
    );
  }

  // Annoteer de pagina's voor elke respondent
  respondentCodes.forEach((code, index) => {
    const pagesToAnnotate = calculateAnnotationPages(index, pagesPerRespondent);
    
    pagesToAnnotate.forEach(pageIndex => {
      // Controleer of de pagina wel bestaat voordat we proberen te annoteren
      if (pageIndex < actualPages) {
        const page = pdfDoc.getPage(pageIndex);
        page.drawText(code, {
          x: 20,
          y: page.getHeight() - 40,
          font: helveticaFont,
          size: 10,
          color: rgb(0, 0, 0),
        });
      } else {
        console.warn(`Skipping annotation for respondent ${code} on page index ${pageIndex}, as it is out of bounds.`);
      }
    });
  });

  console.log('PDF annotation completed.');
  
  return await pdfDoc.save();
} 