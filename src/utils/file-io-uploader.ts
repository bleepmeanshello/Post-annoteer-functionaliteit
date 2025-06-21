import axios from 'axios';
import FormData from 'form-data';

interface FileIoResponse {
  success: boolean;
  key: string;
  link: string;
  expiry: string;
}

/**
 * Uploads a buffer to file.io and returns the download link and expiry date.
 * @param zipBuffer The buffer of the ZIP file to upload.
 * @param filename The desired filename for the uploaded file.
 * @returns A Promise resolving to an object with the URL and expiry date.
 */
export async function uploadToFileIo(zipBuffer: Buffer, filename: string): Promise<{ url: string; expires: string }> {
  console.log(`Uploading ${filename} (${(zipBuffer.length / 1024).toFixed(2)} KB) to file.io...`);
  
  const form = new FormData();
  form.append('file', zipBuffer, filename);
  form.append('expires', '14d');

  try {
    const response = await axios.post<FileIoResponse>('https://file.io/', form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (!response.data.success) {
      throw new Error(`file.io returned an error: ${JSON.stringify(response.data)}`);
    }

    console.log(`Successfully uploaded to file.io. URL: ${response.data.link}`);
    return {
      url: response.data.link,
      expires: response.data.expiry,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error uploading to file.io:`, error.response?.data || error.message);
      throw new Error(`Failed to upload to file.io: ${error.response?.data?.message || error.message}`);
    } else if (error instanceof Error) {
        console.error(`Unknown error uploading to file.io:`, error.message);
        throw new Error(`An unknown error occurred during file upload: ${error.message}`);
    }
    throw new Error('An unknown error occurred during file upload.');
  }
} 