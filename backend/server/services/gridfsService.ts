import { Readable } from 'stream';
import { ObjectId, GridFSBucket } from 'mongodb';
import { initGridFSBucket } from '../config/gridfsConfig.js';

let gridfsBucket: GridFSBucket;

export class GridFSService {
  static async initialize() {
    gridfsBucket = await initGridFSBucket();
  }

  static async ensureBucket() {
    try {
      if (!gridfsBucket) {
        console.log('GridFS bucket not initialized, initializing now...');
        await this.initialize();
        if (!gridfsBucket) {
          throw new Error('Failed to initialize GridFS bucket');
        }
        console.log('GridFS bucket initialized successfully');
      }
      return gridfsBucket;
    } catch (error) {
      console.error('Error ensuring GridFS bucket:', error);
      throw new Error(`Failed to ensure GridFS bucket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a file to GridFS
   * @param fileBuffer - The file buffer to upload
   * @param filename - The name of the file
   * @param metadata - Additional metadata for the file
   * @returns The ID of the uploaded file
   */
  static async uploadFile(fileBuffer: Buffer, filename: string, metadata: any = {}): Promise<ObjectId> {
    const bucket = await this.ensureBucket();
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        metadata
      });

      const readableStream = new Readable();
      readableStream.push(fileBuffer);
      readableStream.push(null);

      readableStream.pipe(uploadStream)
        .on('error', (error: Error) => reject(error))
        .on('finish', () => resolve(uploadStream.id));
    });
  }

  /**
   * Download a file from GridFS
   * @param fileId - The ID of the file to download
   * @returns The file buffer and metadata
   */
  static async downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: any }> {
    const bucket = await this.ensureBucket();
    return new Promise((resolve, reject) => {
      const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));
      const chunks: Buffer[] = [];

      downloadStream
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('error', (error: Error) => reject(error))
        .on('end', async () => {
          try {
            const file = await bucket.find({ _id: new ObjectId(fileId) }).next();
            if (!file) {
              reject(new Error('File not found'));
              return;
            }
            resolve({
              buffer: Buffer.concat(chunks),
              metadata: file.metadata || {}
            });
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  /**
   * Delete a file from GridFS
   * @param fileId - The ID of the file to delete
   */
  static async deleteFile(fileId: string): Promise<void> {
    const bucket = await this.ensureBucket();
    await bucket.delete(new ObjectId(fileId));
  }

  /**
   * Get file metadata from GridFS
   * @param fileId - The ID of the file
   * @returns The file metadata
   */
  static async getFileMetadata(fileId: string): Promise<any> {
    const bucket = await this.ensureBucket();
    const file = await bucket.find({ _id: new ObjectId(fileId) }).next();
    if (!file) {
      throw new Error('File not found');
    }
    return file.metadata;
  }

  /**
   * List all files in GridFS
   * @returns Array of file information
   */
  static async listFiles(): Promise<any[]> {
    const bucket = await this.ensureBucket();
    const files = await bucket.find().toArray();
    return files.map((file: any) => ({
      id: file._id,
      filename: file.filename,
      metadata: file.metadata
    }));
  }

  /**
   * Create a read stream for a file
   * @param fileId - The ID of the file
   * @returns A readable stream of the file
   */
  static async createReadStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const bucket = await this.ensureBucket();
    return bucket.openDownloadStream(new ObjectId(fileId));
  }

  /**
   * Create a write stream for a new file
   * @param filename - The name of the file
   * @param metadata - Additional metadata for the file
   * @returns A writable stream for the file
   */
  static async createWriteStream(filename: string, metadata: any = {}): Promise<NodeJS.WritableStream> {
    const bucket = await this.ensureBucket();
    return bucket.openUploadStream(filename, { metadata });
  }
}

// Export both the class and a default instance
export default GridFSService; 