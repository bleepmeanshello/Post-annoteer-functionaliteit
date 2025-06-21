import axios from 'axios';

export interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Downloads an image from a given URL, supporting PNG and JPEG formats.
 * @param url The URL of the image to download.
 * @returns A Promise resolving to an object with the image buffer and its content-type.
 */
export async function downloadImage(url: string): Promise<DownloadedImage> {
  console.log(`Starting image download from: ${url}`);
  try {
    const response = await axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
      timeout: 10000, // 10-second timeout
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download image. Status code: ${response.status}`);
    }

    const contentType = response.headers['content-type'];
    if (!contentType || !['image/png', 'image/jpeg'].includes(contentType)) {
      throw new Error(`Unsupported content-type: '${contentType}'. Only PNG and JPEG are supported.`);
    }

    console.log(`Successfully downloaded image from ${url} (Type: ${contentType})`);
    return {
      buffer: response.data,
      contentType: contentType,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error downloading image from ${url}: ${error.message}`);
      throw new Error(`Failed to download image: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Unknown error downloading image from ${url}:`, error.message);
      throw new Error(`An unknown error occurred while downloading the image: ${error.message}`);
    }
    throw new Error('An unknown error occurred while downloading the image.');
  }
} 