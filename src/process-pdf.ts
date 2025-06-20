import { Handler } from 'aws-lambda';

export const handler: Handler = async (event, context) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No body found in the request." }),
    };
  }
  
  try {
    // Uw PDF-verwerkingslogica komt hier
    // Voorbeeld: parseer de body, verwerk de PDF, etc.
    const body = JSON.parse(event.body);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "PDF processed successfully!", data: body }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error processing PDF.", error: error.message }),
    };
  }
}; 