import { Handler } from '@netlify/functions';
import { calculateAnnotationPages, getPagesPerRespondentBlock } from './utils/page-calculator';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Een test-endpoint dat berekeningsvoorbeelden voor PDF-annotatie retourneert.
 */
export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const scenarios = [
      { title: "2 respondents, 4 questionnaire pages", respondents: 2, pages: 4 },
      { title: "3 respondents, 5 questionnaire pages", respondents: 3, pages: 5 },
      { title: "1 respondent, 3 questionnaire pages", respondents: 1, pages: 3 },
    ];

    const results = scenarios.map(scenario => {
      const pagesPerBlock = getPagesPerRespondentBlock(scenario.pages);
      const breakdown = Array.from({ length: scenario.respondents }, (_, i) => ({
        respondentIndexInPdf: i,
        annotationPages: calculateAnnotationPages(i, scenario.pages),
      }));

      return {
        scenario: scenario.title,
        pagesPerRespondentBlock: pagesPerBlock,
        totalExpectedPdfPages: pagesPerBlock * scenario.respondents,
        breakdown,
      };
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(results, null, 2),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Error generating test data", error: error.message }),
    };
  }
}; 