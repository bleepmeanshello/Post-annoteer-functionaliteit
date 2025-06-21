import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
import { calculateAnnotationPages, getPagesPerRespondentBlock } from './page-calculator';
import { downloadImage } from './image-downloader';

/**
 * Loads a PDF, adds respondent codes and a logo to the specified pages, and returns the modified PDF.
 * 
 * @param pdfBuffer The buffer of the original PDF.
 * @param respondentCodes The codes of the respondents included in this PDF.
 * @param logoUrl The URL of the logo to be embedded.
 * @param pagesPerQuestionnaire The number of questionnaire pages for each respondent.
 * @returns A Promise that resolves to a Uint8Array of the modified PDF.
 */
export async function annotatePdf(
  pdfBuffer: Buffer,
  respondentCodes: string[],
  logoUrl: string,
  pagesPerQuestionnaire: number
): Promise<Uint8Array> {
  console.log(`Annotating PDF for ${respondentCodes.length} respondents.`);
  
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Download en embed het logo; ga door zonder logo als dit mislukt.
  let logoImage: PDFImage | undefined;
  try {
    if (logoUrl) {
      console.log('Attempting to download logo...');
      const { buffer: logoBuffer, contentType } = await downloadImage(logoUrl);

      if (contentType === 'image/png') {
        logoImage = await pdfDoc.embedPng(logoBuffer);
      } else if (contentType === 'image/jpeg') {
        logoImage = await pdfDoc.embedJpg(logoBuffer);
      }
      console.log('Logo embedded successfully.');
    }
  } catch (error: any) {
    console.warn(`Could not download or embed logo. Continuing without it. Reason: ${error.message}`);
  }

  // Veiligheidscontrole: controleer of het PDF-document het verwachte aantal pagina's heeft.
  const expectedPages = getPagesPerRespondentBlock(pagesPerQuestionnaire) * respondentCodes.length;
  const actualPages = pdfDoc.getPageCount();
  if (expectedPages !== actualPages) {
    console.warn(
      `Warning: PDF page count mismatch. Expected ${expectedPages} pages based on ` +
      `${respondentCodes.length} respondents with blocks of ${getPagesPerRespondentBlock(pagesPerQuestionnaire)} pages, ` +
      `but document has ${actualPages} pages. Annotation will proceed but might be incorrect.`
    );
  }

  // Annoteer de pagina's voor elke respondent
  respondentCodes.forEach((code, index) => {
    const pagesToAnnotate = calculateAnnotationPages(index, pagesPerQuestionnaire);
    
    pagesToAnnotate.forEach(pageIndex => {
      // Controleer of de pagina wel bestaat voordat we proberen te annoteren
      if (pageIndex < actualPages) {
        const page = pdfDoc.getPage(pageIndex);
        
        // Teken de respondentcode
        console.log(`  > Drawing code '${code}' on page index ${pageIndex}`);
        page.drawText(code, {
          x: 20,
          y: page.getHeight() - 40,
          font: helveticaFont,
          size: 10,
          color: rgb(0, 0, 0),
        });

        // Teken het logo als het bestaat
        if (logoImage) {
          const maxDim = 100;
          const logoDims = logoImage.scale(1);
          
          const ratio = Math.min(maxDim / logoDims.width, maxDim / logoDims.height);
          const scaledWidth = logoDims.width * ratio;
          const scaledHeight = logoDims.height * ratio;

          console.log(`  > Drawing logo on page index ${pageIndex}`);
          page.drawImage(logoImage, {
            x: page.getWidth() - scaledWidth - 20,
            y: page.getHeight() - scaledHeight - 20,
            width: scaledWidth,
            height: scaledHeight,
          });
        }

        // --- Voeg footer toe ---
        const footerContinueText = 'Let op: de vragenlijst gaat verder op de achterkant.';
        const footerEndText = 'Einde van de vragenlijst. Bedankt voor het invullen.';

        const isLastPageOfRespondent = pageIndex === pagesToAnnotate[pagesToAnnotate.length - 1];
        const footerText = isLastPageOfRespondent ? footerEndText : footerContinueText;

        // Teken de achtergrond-rechthoek
        const rectWidth = page.getWidth() * 0.8;
        page.drawRectangle({
          x: page.getWidth() * 0.1,
          y: 20,
          width: rectWidth,
          height: 28,
          color: rgb(0.9, 0.9, 0.9),
        });

        // Teken de footer-tekst
        const textWidth = helveticaFont.widthOfTextAtSize(footerText, 10);
        console.log(`  > Drawing footer ('${footerText.substring(0, 20)}...') on page index ${pageIndex}`);
        page.drawText(footerText, {
          x: (page.getWidth() - textWidth) / 2,
          y: 26, // Baseline voor de tekst, verticaal gecentreerd in de rechthoek
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