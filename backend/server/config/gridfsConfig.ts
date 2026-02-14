import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";
import { GridFsStorage } from 'multer-gridfs-storage';

interface FileInfo {
  filename: string;
  bucketName: string;
  metadata: {
    originalname: string;
    contentType: string;
  };
}

interface MulterFile {
  originalname: string;
  mimetype: string;
}

let gridfsBucket: GridFSBucket;

// Initialize GridFS bucket
const initGridFSBucket = async () => {
  try {
    console.log('Initializing GridFS bucket...');
    
    if (!mongoose.connection) {
      throw new Error('No mongoose connection available');
    }
    
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }

    console.log('MongoDB connection status:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    gridfsBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'stories'
    });

    // Test if bucket is accessible
    try {
      await gridfsBucket.find().limit(1).toArray();
      console.log('GridFS bucket initialized and tested successfully');
    } catch (bucketError) {
      console.error('Error testing GridFS bucket:', bucketError);
      throw new Error('Failed to access GridFS bucket after initialization');
    }

    return gridfsBucket;
  } catch (error) {
    console.error('Error initializing GridFS bucket:', error);
    throw error;
  }
};

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || 'mongodb://localhost:27017/phileread',
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req: any, file: any) => {
    return {
      bucketName: 'stories',
      filename: `${Date.now()}-${file.originalname}`,
      metadata: {
        uploadedBy: req.user?.id,
        contentType: file.mimetype,
        grade: req.body?.grade
      }
    };
  }
});

export { storage, initGridFSBucket, gridfsBucket }; 