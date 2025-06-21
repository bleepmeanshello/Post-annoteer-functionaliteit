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
  // Validate URL format and restrict to HTTP/HTTPS
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }
  
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  
  // Prevent SSRF by blocking private IP ranges
  const hostname = parsedUrl.hostname;
  if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || 
      hostname.startsWith('10.') || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
    throw new Error('Requests to private IP addresses are not allowed');
  }

  console.log(`Starting image download from: ${url}`);
  try {
    const response = await axios.get<ArrayBuffer>(url, {
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

    // Validate actual file content by checking magic bytes
    const buffer = Buffer.from(response.data);
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    const isJpeg = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]));
    
    if (contentType === 'image/png' && !isPng) {
      throw new Error('File content does not match PNG format despite content-type header');
    }
    if (contentType === 'image/jpeg' && !isJpeg) {
      throw new Error('File content does not match JPEG format despite content-type header');  
    }

    console.log(`Successfully downloaded image from ${url} (Type: ${contentType})`);
    return {
      buffer: buffer,
      contentType: contentType,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error downloading image from ${url}:`, error.message);
      throw new Error(`Failed to download image: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Unknown error downloading image from ${url}:`, error.message);
      throw new Error(`An unknown error occurred while downloading the image: ${error.message}`);
    }
    throw new Error('An unknown error occurred while downloading the image.');
  }
} 