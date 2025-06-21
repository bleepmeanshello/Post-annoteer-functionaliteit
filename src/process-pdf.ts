import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { downloadPdf } from "./utils/pdf-downloader";
import { annotatePdf } from "./utils/pdf-annotator";
import { calculateAnnotationPages, getPagesPerRespondentBlock } from "./utils/page-calculator";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // Of een specifiek domein voor extra veiligheid
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface Metadata {
  logoUrl: string;
  pagesCount: number;
  respondenten: { code: string }[];
}

interface RequestBody {
  pdfUrls: string[];
  annotate: boolean;
  metadata: Metadata;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle preflight CORS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }
  
  // Accepteer alleen POST-verzoeken
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Request body is missing." }),
      };
    }

    const body: RequestBody = JSON.parse(event.body);

    // Valideer de request body
    const { pdfUrls, annotate, metadata } = body;
    if (
      !pdfUrls ||
      !Array.isArray(pdfUrls) ||
      !pdfUrls.every((url) => typeof url === "string")
    ) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Invalid 'pdfUrls': must be an array of strings." }),
      };
    }

    if (typeof annotate !== "boolean") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Invalid 'annotate': must be a boolean." }),
      };
    }

    if (
      !metadata ||
      typeof metadata.logoUrl !== "string" ||
      typeof metadata.pagesCount !== "number" ||
      !Array.isArray(metadata.respondenten) ||
      !metadata.respondenten.every(r => r && typeof r.code === 'string')
    ) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Invalid 'metadata' object or its properties." }),
      };
    }
    
    // DEBUG MODE: Voer een "dry run" uit en retourneer de berekeningen
    if (event.queryStringParameters?.debug === 'true') {
      const totalRespondents = metadata.respondenten.length;
      const respondentsPerPdf = Math.ceil(totalRespondents / pdfUrls.length);
      
      const debugPlan = pdfUrls.map((url, pdfIndex) => {
        const startIndex = pdfIndex * respondentsPerPdf;
        const endIndex = startIndex + respondentsPerPdf;
        const respondentSlice = metadata.respondenten.slice(startIndex, endIndex);
        const respondentCodes = respondentSlice.map(r => r.code);
        
        const respondentDetails = respondentCodes.map((code, respondentIndexInPdf) => ({
          code,
          annotationPages: calculateAnnotationPages(respondentIndexInPdf, metadata.pagesCount)
        }));

        return {
          pdfUrl: url,
          pdfIndex: pdfIndex,
          respondentsAssigned: respondentCodes.length,
          respondentCodes,
          respondentDetails
        };
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          debug: true,
          totalRespondents,
          respondentsPerPdf,
          pagesPerQuestionnaire: metadata.pagesCount,
          pagesPerRespondentBlock: getPagesPerRespondentBlock(metadata.pagesCount),
          plan: debugPlan
        }, null, 2)
      };
    }

    // Download alle PDFs
    const pdfBuffers: Buffer[] = [];
    for (let i = 0; i < pdfUrls.length; i++) {
      const url = pdfUrls[i];
      console.log(`Downloading PDF ${i + 1} of ${pdfUrls.length}...`);
      try {
        const buffer = await downloadPdf(url);
        pdfBuffers.push(buffer);
      } catch (downloadError: any) {
        console.error(`Failed to download PDF from ${url}:`, downloadError.message);
        // Gooi de error door naar de main catch block om een 500 response te triggeren
        throw new Error(`Failed to process PDF from ${url}. Reason: ${downloadError.message}`);
      }
    }

    // Verdeel respondenten over de PDF-bestanden en annoteer
    const totalRespondents = metadata.respondenten.length;
    const respondentsPerPdf = Math.ceil(totalRespondents / pdfUrls.length);
    const annotatedPdfBuffers: (Buffer | Uint8Array)[] = [];

    for (let i = 0; i < pdfBuffers.length; i++) {
      const startIndex = i * respondentsPerPdf;
      const endIndex = startIndex + respondentsPerPdf;
      const respondentSlice = metadata.respondenten.slice(startIndex, endIndex);
      const respondentCodes = respondentSlice.map(r => r.code);
      
      console.log(`Processing PDF ${i + 1} with ${respondentCodes.length} respondents.`);

      if (respondentCodes.length > 0) {
        const annotatedBuffer = await annotatePdf(
          pdfBuffers[i],
          respondentCodes,
          metadata.logoUrl,
          metadata.pagesCount // Dit is het aantal enquêtepagina's
        );
        annotatedPdfBuffers.push(annotatedBuffer);
      } else {
        // Als er geen respondenten zijn voor deze PDF, voeg de originele buffer toe
        annotatedPdfBuffers.push(pdfBuffers[i]);
      }
    }

    // Mock response voor nu
    const mockResponse = {
      status: "success",
      fileIoUrl: "https://file.io/test",
      expires: "2024-12-31",
      respondentCount: metadata.respondenten.length,
      filesInZip: pdfUrls.length,
      respondentsPerFile: [] // Dit wordt later gevuld
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(mockResponse),
    };
  } catch (error: any) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
}; 