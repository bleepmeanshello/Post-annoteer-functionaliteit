import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { downloadPdf } from "./utils/pdf-downloader";
import { annotatePdf } from "./utils/pdf-annotator";
import { calculateAnnotationPages, getPagesPerRespondentBlock } from "./utils/page-calculator";
import { createZip } from "./utils/zip-creator";
import { uploadToFileIo } from "./utils/file-io-uploader";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*", // Use env var for production
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

/**
 * Verdeelt respondenten over de PDF-bestanden en berekent de annotatiedetails.
 */
function distributeRespondents(
  respondenten: { code: string }[], 
  pdfUrls: string[],
  pagesCount: number
) {
  const totalRespondents = respondenten.length;
  const respondentsPerPdf = Math.ceil(totalRespondents / pdfUrls.length);
  
  return pdfUrls.map((url, pdfIndex) => {
    const startIndex = pdfIndex * respondentsPerPdf;
    const endIndex = startIndex + respondentsPerPdf;
    const respondentSlice = respondenten.slice(startIndex, endIndex);
    const respondentCodes = respondentSlice.map(r => r.code);
    
    const respondentDetails = respondentCodes.map((code, respondentIndexInPdf) => ({
      code,
      annotationPages: calculateAnnotationPages(respondentIndexInPdf, pagesCount)
    }));

    return {
      pdfUrl: url,
      pdfIndex,
      respondentsAssigned: respondentCodes.length,
      respondentCodes,
      respondentDetails
    };
  });
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const handlerStartTime = Date.now();
  console.log('--- Function execution started ---');

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
    
    // Genereer het distributieplan
    const distributionPlan = distributeRespondents(metadata.respondenten, pdfUrls, metadata.pagesCount);

    // DEBUG MODE: Voer een "dry run" uit en retourneer de berekeningen
    if (event.queryStringParameters?.debug === 'true') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          debug: true,
          totalRespondents: metadata.respondenten.length,
          respondentsPerPdf: Math.ceil(metadata.respondenten.length / pdfUrls.length),
          pagesPerQuestionnaire: metadata.pagesCount,
          pagesPerRespondentBlock: getPagesPerRespondentBlock(metadata.pagesCount),
          plan: distributionPlan
        }, null, 2)
      };
    }

    // --- STAP 1 & 2: Download en Annoteer PDFs ---
    const annotatedPdfBuffers: (Buffer | Uint8Array)[] = [];
    const respondentsPerFile: number[] = [];

    for (const planItem of distributionPlan) {
      const loopStartTime = Date.now();
      
      console.log(`Processing PDF ${planItem.pdfIndex + 1} of ${pdfUrls.length}...`);
      
      try {
        // Download
        const pdfBuffer = await downloadPdf(planItem.pdfUrl);
        
        // Annoteer
        const respondentCodes = planItem.respondentCodes;
        respondentsPerFile.push(respondentCodes.length);

        if (respondentCodes.length > 0) {
          const annotatedBuffer = await annotatePdf(
            pdfBuffer,
            respondentCodes,
            metadata.logoUrl,
            metadata.pagesCount
          );
          annotatedPdfBuffers.push(annotatedBuffer);
        } else {
          annotatedPdfBuffers.push(pdfBuffer);
        }
        
        console.log(`PDF ${planItem.pdfIndex + 1} processed in ${Date.now() - loopStartTime}ms`);

      } catch (processingError: any) {
        console.error(`Failed to process PDF from ${planItem.pdfUrl}:`, processingError.message);
        throw new Error(`Failed to process PDF from ${planItem.pdfUrl}. Reason: ${processingError.message}`);
      }
    }
    
    // --- STAP 3: Maak ZIP-bestand ---
    const zipCreationStartTime = Date.now();
    const filesToZip = annotatedPdfBuffers.map((buffer, index) => ({
      buffer,
      filename: `batch_${index + 1}.pdf`,
    }));

    const zipBuffer = await createZip(filesToZip);
    console.log(`ZIP created in ${Date.now() - zipCreationStartTime}ms`);

    // Valideer bestandsgrootte (2GB limiet)
    const TWO_GB = 2 * 1024 * 1024 * 1024;
    if (zipBuffer.length > TWO_GB) {
      return {
        statusCode: 413, // Payload Too Large
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: `Generated ZIP file is too large to upload (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
        }),
      };
    }

    // --- STAP 4: Upload ZIP-bestand ---
    const uploadStartTime = Date.now();
    let uploadResult;
    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = `respondenten_${today}.zip`;
      uploadResult = await uploadToFileIo(zipBuffer, filename);
      console.log(`Upload completed in ${Date.now() - uploadStartTime}ms`);
    } catch (uploadError: any) {
      console.error('File.io upload failed.', uploadError.message);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'Failed to upload ZIP file to file.io.',
          error: uploadError.message,
          zipSize: `${(zipBuffer.length / 1024).toFixed(2)} KB`,
        }),
      };
    }
    
    // --- STAP 5: Stel de uiteindelijke response samen ---
    const zipSizeMB = parseFloat((zipBuffer.length / (1024 * 1024)).toFixed(2));
    const finalResponse = {
      status: "success",
      fileIoUrl: uploadResult.url,
      expires: uploadResult.expires,
      respondentCount: metadata.respondenten.length,
      filesInZip: annotatedPdfBuffers.length,
      respondentsPerFile,
      zipSizeMB,
    };

    console.log(`--- Function execution finished in ${Date.now() - handlerStartTime}ms ---`);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(finalResponse),
    };
  } catch (error: any) {
    console.error(`--- Function execution failed in ${Date.now() - handlerStartTime}ms ---`);
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
}; 