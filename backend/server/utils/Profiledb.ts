import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI as string;

console.log('MONGODB_URI:', process.env.MONGODB_URI);

export const connectProfileDb = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as any);
    console.log('Connected to MongoDB (Profiledb):', mongoose.connection.name);
  } catch (error) {
    console.error('MongoDB (Profiledb) connection error:', error);
  }
}; 