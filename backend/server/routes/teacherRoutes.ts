import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import Teacher from '../models/Teacher.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload teacher profile image by teacherId (firebaseUid)
// This will always replace the old image with the new one in the database
const uploadProfileImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teacherId } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }
    // Store image as base64 string in the teacher document
    const imageBase64 = req.file.buffer.toString('base64');
    // This will overwrite any existing profileImage
    const teacher = await Teacher.findOneAndUpdate(
      { firebaseUid: teacherId },
      { profileImage: imageBase64 },
      { new: true }
    );
    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
};

// Get teacher profile image by teacherId (firebaseUid)
const getProfileImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findOne({ firebaseUid: teacherId });
    if (!teacher || !teacher.profileImage) {
      res.json({ profileImage: null });
      return;
    }
    // Return as JSON with base64 string
    res.json({ profileImage: teacher.profileImage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
};

// Sync teacher profile by firebaseUid
const syncTeacherProfile = async (req: Request, res: Response): Promise<void> => {
  const { firebaseUid, name, email } = req.body;
  console.log('SYNC CALLED:', { firebaseUid, name, email });
  if (!firebaseUid || !email) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  try {
    const teacher = await Teacher.findOneAndUpdate(
      { firebaseUid },
      { name, email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('SYNC RESULT:', teacher);
    res.json({ success: true, teacher });
  } catch (error) {
    console.error('SYNC ERROR:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
};

router.post('/:teacherId/profile-image', upload.single('image'), uploadProfileImage);
router.get('/:teacherId/profile-image', getProfileImage);
router.post('/sync', syncTeacherProfile);

export default router; 