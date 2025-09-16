import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('MONGODB_URI:', process.env.MONGODB_URI); // Debug line

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!, {})
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/api/test-mongo', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ connected: true });
  } catch (e: any) {
    res.json({ connected: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Test MongoDB connection server running on port ${PORT}`);
});

const mongoURI = process.env.MONGODB_URI as string;

const teacherSchema = new mongoose.Schema({
  firebaseUid: String,
  name: String,
  email: String,
  profileImage: String,
}, { collection: 'Teacher' });

const Teacher = mongoose.model('Teacher', teacherSchema);

async function test() {
  await mongoose.connect(mongoURI);
  const doc = await Teacher.create({
    firebaseUid: 'testuid',
    name: 'Test Teacher',
    email: 'test@teacher.com',
    profileImage: 'testimagebase64',
  });
  console.log('Inserted:', doc);
  await mongoose.disconnect();
}

test(); 