import axios from 'axios';

/**
 * Downloads a file from a given URL and returns it as a Buffer.
 * @param url The URL of the file to download.
 * @returns A Promise that resolves to a Buffer containing the file data.
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  console.log(`Starting download from: ${url}`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download PDF from ${url}. Status code: ${response.status}`);
    }

    console.log(`Successfully completed download from: ${url}`);
    return Buffer.from(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error downloading from ${url}:`, error.message);
      throw new Error(`Failed to download PDF from ${url}: ${error.message}`);
    } else {
      console.error(`Unknown error downloading from ${url}:`, error);
      throw new Error(`An unknown error occurred while downloading the PDF from ${url}.`);
    }
  }
} 