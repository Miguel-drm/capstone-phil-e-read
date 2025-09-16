import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { initGridFSBucket } from '../config/gridfsConfig.js';

export const teacherProfileImageService = {
  async uploadProfileImage(buffer: Buffer, filename: string, mimetype: string) {
    const gridfsBucket: GridFSBucket = await initGridFSBucket();
    return new Promise((resolve, reject) => {
      const uploadStream = gridfsBucket.openUploadStream(filename, {
        contentType: mimetype,
        metadata: { uploadedFor: 'teacherProfile' }
      });

      uploadStream.on('finish', (file: any) => resolve(file._id.toString()));
      uploadStream.on('error', reject);

      uploadStream.end(buffer);
    });
  },

  async getProfileImage(fileId: string) {
    const gridfsBucket: GridFSBucket = await initGridFSBucket();
    return gridfsBucket.openDownloadStream(new ObjectId(fileId));
  }
}; 