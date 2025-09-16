import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  profileImage: { type: String }, // base64 string
  // Add other teacher fields as needed
}, { timestamps: true, collection: 'Teacher' });

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher; 