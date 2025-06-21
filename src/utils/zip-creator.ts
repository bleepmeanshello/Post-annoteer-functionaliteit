import archiver from 'archiver';

export interface ZipInputFile {
  buffer: Buffer | Uint8Array;
  filename: string;
}

/**
 * Creates a ZIP archive in memory from a list of file buffers.
 * @param files An array of objects, each with a buffer and a filename.
 * @returns A Promise that resolves to a Buffer containing the ZIP archive.
 */
export function createZip(files: ZipInputFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    console.log(`Creating ZIP archive with ${files.length} file(s)...`);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Set compression level
    });

    const buffers: Buffer[] = [];
    archive.on('data', (data) => buffers.push(data));
    archive.on('end', () => {
      console.log('ZIP archive successfully created.');
      resolve(Buffer.concat(buffers));
    });
    archive.on('error', (err) => {
      console.error('Error creating ZIP archive:', err);
      reject(err);
    });

    for (const file of files) {
      archive.append(Buffer.from(file.buffer), { name: file.filename });
    }

    archive.finalize();
  });
} 