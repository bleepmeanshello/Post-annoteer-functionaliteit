import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

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