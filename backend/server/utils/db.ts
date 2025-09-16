import mongoose from 'mongoose';
import { initGridFSBucket } from '../config/gridfsConfig.js';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI environment variable is not defined');
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string format:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));

    await mongoose.connect(mongoUri, {
      // These options help with connection stability
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000, // Increased timeout
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      wtimeoutMS: 2500
    });

    console.log('MongoDB Connected Successfully');
    console.log('Connection Status:', mongoose.connection.readyState);
    console.log('Database Name:', mongoose.connection.db.databaseName);
    console.log('Collections:', await mongoose.connection.db.listCollections().toArray());

    // Initialize GridFS after connection
    try {
      await initGridFSBucket();
      console.log('GridFS initialized successfully');
    } catch (gridfsError) {
      console.error('Failed to initialize GridFS:', gridfsError);
      throw gridfsError;
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      console.error('Connection Status:', mongoose.connection.readyState);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
      console.warn('Last Connection Status:', mongoose.connection.readyState);
    });

    mongoose.connection.on('reconnected', async () => {
      console.log('MongoDB reconnected');
      console.log('New Connection Status:', mongoose.connection.readyState);
      try {
        await initGridFSBucket();
        console.log('GridFS re-initialized after reconnection');
      } catch (gridfsError) {
        console.error('Failed to re-initialize GridFS after reconnection:', gridfsError);
      }
    });

    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Connection Status:', mongoose.connection?.readyState);
    if (error instanceof Error) {
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
    }
    throw error;
  }
};

export default connectDB;