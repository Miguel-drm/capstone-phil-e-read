// This script will patch the running server to properly handle grade and storySet
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Import the Story model
const Story = require('./dist/models/Story.js').default;

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Create a new Express app on a different port to test
const app = express();
app.use(express.json());
app.use(require('cors')());

// GET all stories
app.get('/api/stories', async (req, res) => {
  try {
    console.log('🔍 Getting all stories');
    const stories = await Story.find({ isActive: true }).sort({ createdAt: -1 });
    
    // Add PDF availability information to each story
    const storiesWithPdfInfo = stories.map(story => ({
      ...story.toObject(),
      hasPdf: !!(story.pdfData || story.pdfFileId)
    }));
    
    console.log(`✅ Found ${stories.length} stories`);
    res.json(storiesWithPdfInfo);
  } catch (error) {
    console.error('❌ Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// GET single story by ID
app.get('/api/stories/:id', async (req, res) => {
  try {
    console.log('🔍 Getting story by ID:', req.params.id);
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('❌ Invalid story ID format:', req.params.id);
      return res.status(400).json({ error: 'Invalid story ID format' });
    }
    
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      console.error('❌ Story not found:', req.params.id);
      return res.status(404).json({ error: 'Story not found' });
    }
    
    console.log('✅ Story found:', {
      id: story._id,
      title: story.title,
      grade: story.grade,
      storySet: story.storySet,
      hasPdf: !!(story.pdfData || story.pdfFileId)
    });
    
    // Add PDF availability information
    const storyWithPdfInfo = {
      ...story.toObject(),
      hasPdf: !!(story.pdfData || story.pdfFileId)
    };
    
    res.json(storyWithPdfInfo);
  } catch (error) {
    console.error('❌ Error fetching story by ID:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Fixed story creation endpoint
app.post('/api/stories', upload.single('pdf'), async (req, res) => {
  try {
    console.log('🔍 Fixed backend received:', {
      body: Object.keys(req.body),
      grade: req.body.grade,
      storySet: req.body.storySet,
      hasFile: !!req.file,
      fileSize: req.file?.size,
      fileName: req.file?.originalname,
      fileType: req.file?.mimetype
    });

    if (!req.file) {
      console.error('❌ No PDF file received');
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Validate PDF file
    if (req.file.mimetype !== 'application/pdf') {
      console.error('❌ Invalid file type:', req.file.mimetype);
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Check file size (max 10MB)
    if (req.file.size > 10 * 1024 * 1024) {
      console.error('❌ File too large:', req.file.size);
      return res.status(400).json({ error: 'PDF file must be smaller than 10MB' });
    }

    // Validate PDF header
    const pdfHeader = req.file.buffer.slice(0, 4).toString();
    if (!pdfHeader.startsWith('%PDF')) {
      console.error('❌ Invalid PDF header:', pdfHeader);
      return res.status(400).json({ error: 'Invalid PDF file: Missing PDF header' });
    }

    console.log('✅ PDF file validation passed:', {
      size: req.file.size,
      type: req.file.mimetype,
      header: pdfHeader
    });

    const { title, description, language, createdBy, readingLevel, categories, grade, storySet } = req.body;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Parse categories if it's a string
    let parsedCategories;
    try {
      parsedCategories = categories ? JSON.parse(categories) : undefined;
    } catch (error) {
      parsedCategories = undefined;
    }

    // Convert PDF to base64 for storage
    const pdfBase64 = req.file.buffer.toString('base64');
    console.log('📄 PDF converted to base64:', {
      originalSize: req.file.size,
      base64Length: pdfBase64.length,
      compressionRatio: (pdfBase64.length / req.file.size).toFixed(2)
    });

    // Create story data with explicit grade and storySet
    const storyData = {
      title: title.trim(),
      description: description.trim(),
      language: language || 'english',
      createdBy,
      readingLevel,
      categories: parsedCategories,
      grade: grade || '3',  // Ensure grade is set
      storySet: storySet || 'A',  // Ensure storySet is set
      textContent: '',
      isActive: true,
      pdfData: pdfBase64
    };

    console.log('🔍 Creating story with data:', {
      title: storyData.title,
      grade: storyData.grade,
      storySet: storyData.storySet,
      hasPdfData: !!storyData.pdfData,
      pdfDataLength: storyData.pdfData.length
    });

    const story = new Story(storyData);
    await story.save();

    console.log('✅ Story saved successfully:', {
      id: story._id,
      title: story.title,
      grade: story.grade,
      storySet: story.storySet
    });

    res.status(201).json(story);
  } catch (error) {
    console.error('❌ Error creating story:', error);
    res.status(400).json({ error: 'Failed to create story', details: error.message });
  }
});

// UPDATE story
app.put('/api/stories/:id', upload.single('pdf'), async (req, res) => {
  try {
    console.log('🔍 Updating story:', req.params.id, 'with data:', Object.keys(req.body));
    
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Update fields from request body
    const updateData = {};
    if (req.body.title) updateData.title = req.body.title.trim();
    if (req.body.description) updateData.description = req.body.description.trim();
    if (req.body.language) updateData.language = req.body.language;
    if (req.body.grade) updateData.grade = req.body.grade;
    if (req.body.storySet) updateData.storySet = req.body.storySet;

    // Handle PDF file if provided
    if (req.file) {
      updateData.pdfData = req.file.buffer.toString('base64');
    }

    const updatedStory = await Story.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    console.log('✅ Story updated successfully:', {
      id: updatedStory._id,
      title: updatedStory.title,
      grade: updatedStory.grade,
      storySet: updatedStory.storySet
    });

    res.json(updatedStory);
  } catch (error) {
    console.error('❌ Error updating story:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// DELETE story
app.delete('/api/stories/:id', async (req, res) => {
  try {
    console.log('🔍 Deleting story:', req.params.id);
    const story = await Story.findByIdAndDelete(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    console.log('✅ Story deleted successfully');
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// GET story PDF
app.get('/api/stories/:id/pdf', async (req, res) => {
  try {
    console.log('🔍 Getting PDF for story:', req.params.id);
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      console.error('❌ Story not found:', req.params.id);
      return res.status(404).json({ error: 'Story not found' });
    }
    
    // Check if story has base64 PDF data (new format)
    if (story.pdfData) {
      console.log('📄 Converting PDF from base64:', {
        storyTitle: story.title,
        base64Length: story.pdfData.length
      });
      
      const buffer = Buffer.from(story.pdfData, 'base64');
      
      // Validate the converted buffer
      const pdfHeader = buffer.slice(0, 4).toString();
      if (!pdfHeader.startsWith('%PDF')) {
        console.error('❌ Invalid PDF data in database:', pdfHeader);
        return res.status(500).json({ error: 'Corrupted PDF data' });
      }
      
      console.log('✅ PDF successfully retrieved from base64:', {
        bufferSize: buffer.length,
        header: pdfHeader
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${story.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
      return;
    }
    
    // Check if story has GridFS file ID (old format)
    if (story.pdfFileId) {
      console.log('📄 Story uses GridFS storage (old format):', {
        storyTitle: story.title,
        pdfFileId: story.pdfFileId
      });
      
      // For now, return an error message suggesting to re-upload the PDF
      return res.status(404).json({ 
        error: 'PDF stored in old format. Please re-upload the PDF file.',
        details: 'This story was created with an older version. Please edit the story and re-upload the PDF.'
      });
    }
    
    console.log('📄 No PDF data available for story:', {
      storyTitle: story.title,
      storyId: req.params.id
    });
    
    return res.status(404).json({ 
      error: 'No PDF available for this story.',
      details: 'This story does not have a PDF file. Please upload a PDF file for this story.'
    });
    
  } catch (error) {
    console.error('❌ Error getting PDF:', error);
    res.status(500).json({ error: 'Failed to get PDF' });
  }
});

// Test PDF upload endpoint
app.post('/api/test-pdf', upload.single('pdf'), (req, res) => {
  try {
    console.log('🧪 Testing PDF upload:', {
      hasFile: !!req.file,
      fileSize: req.file?.size,
      fileName: req.file?.originalname,
      fileType: req.file?.mimetype
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfHeader = req.file.buffer.slice(0, 4).toString();
    const isValidPdf = pdfHeader.startsWith('%PDF');

    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        isValidPdf: isValidPdf,
        header: pdfHeader
      }
    });
  } catch (error) {
    console.error('❌ Error testing PDF upload:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// Teacher profile image endpoints (to prevent 404 errors)
app.get('/api/teachers/:teacherId/profile-image', (req, res) => {
  // For now, return empty response to prevent 404 errors
  // In a full implementation, this would fetch from database
  res.json({ profileImage: null });
});

app.post('/api/teachers/:teacherId/profile-image', upload.single('image'), (req, res) => {
  // For now, return success response
  // In a full implementation, this would save to database
  res.json({ message: 'Profile image upload endpoint (not implemented)' });
});

// Parent profile image endpoints (to prevent 404 errors)
app.get('/api/parents/:parentId/profile-image', (req, res) => {
  res.json({ profileImage: null });
});

app.post('/api/parents/:parentId/profile-image', upload.single('image'), (req, res) => {
  res.json({ message: 'Profile image upload endpoint (not implemented)' });
});

// Teacher sync endpoint (to prevent 404 errors)
app.post('/api/teachers/sync', (req, res) => {
  res.json({ message: 'Teacher sync endpoint (not implemented)', success: true });
});

// Results endpoints (to prevent 404 errors)
app.post('/api/results', (req, res) => {
  res.json({ message: 'Results creation endpoint (not implemented)', _id: 'temp-id-' + Date.now() });
});

app.get('/api/results/teacher/:teacherId', (req, res) => {
  res.json([]);
});

app.get('/api/results/combined/:studentId', (req, res) => {
  res.json([]);
});

app.get('/api/results/student/:studentId', (req, res) => {
  res.json([]);
});

// Audio transcription endpoint (to prevent 404 errors)
app.post('/api/transcribe', upload.single('audio'), (req, res) => {
  res.json({ message: 'Audio transcription endpoint (not implemented)', transcript: '' });
});

// Start the fixed server on port 5002
const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Fixed backend server running on port ${PORT}`);
  console.log('Update your frontend to use http://localhost:5002/api');
  console.log('📄 PDF upload validation enabled');
  console.log('🧪 Test PDF upload at: POST /api/test-pdf');
});