import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import connectDB from './utils/db.js';
import { mongoStoryService } from './services/mongoStoryService.js';
import { initGridFSBucket } from './config/gridfsConfig.js';
import mongoose from 'mongoose';
import Story, { IStory } from './models/Story.js';
import GridFSService from './services/gridfsService.js';
import teacherRoutes from './routes/teacherRoutes.js';
import parentRoutes from './routes/parentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { resultService } from './services/resultService.js';
import { isrResultService } from './services/isrResultService.js';
import { isrReviewRecordService } from './services/isrReviewRecordService.js';
import { calculateFromISRResult } from './services/isrReviewCalculator.js';
import { startScheduledReportRunner } from './services/scheduledReportRunner.js';
import type { Readable } from 'stream';
import { adminDb, firestoreAdmin } from './config/firebaseAdmin.js';
import { db as firestore } from './config/firebase.js';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
// Removed Node Vosk integration; using external Python Vosk WS instead

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const isProduction = process.env.NODE_ENV === 'production';

// Configure multer for PDF and text file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept both PDF files (for PDF import) and text files (for manual input)
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'));
    }
  },
});

const audioUpload = multer({ storage: multer.memoryStorage() });

// Middleware - CORS configuration
// Allow localhost:3000 for local development and production URLs
const defaultAllowedOrigins = [
  'http://localhost:3000',  // Main frontend port
  // 'https://phil-e-read-1.onrender.com',
  // 'https://phil-e-read-7p2c.onrender.com',
  'https://phileread-api.onrender.com',
  'https://phileread-frontend.onrender.com'
];

const envAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all localhost origins
    if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  if (req.method === 'POST' && req.url.includes('/api/stories')) {
    console.log('📝 POST /api/stories request detected');
  }
  next();
});

app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit!');
  res.json({ message: 'Backend server is working!', timestamp: new Date().toISOString() });
});

// // Serve static files from the frontend's dist directory
// const frontendDistPath = join(__dirname, '..', '..', 'frontend', 'dist');
// console.log('Serving static files from:', frontendDistPath);
// app.use(express.static(frontendDistPath));

// Connect to MongoDB and start server
(async () => {
  try {
    // Connect to MongoDB first
    const db = await connectDB();
    console.log('Connected to MongoDB');

    // Initialize GridFS
    await initGridFSBucket();
    console.log('GridFS initialized');

    // Handle database disconnection
    db.on('disconnected', () => {
      console.error('Lost MongoDB connection. Please check your database connection.');
    });

    db.on('error', (error) => {
      console.error('MongoDB error:', error);
    });

    // Story Routes
    app.get('/', (req: Request, res: Response) => {
      res.send('Phil-E-Read backend is running.');
    });

    app.get('/api/stories', async (req: Request, res: Response) => {
      try {
        console.log('📚 /api/stories endpoint called');
        console.log('Request origin:', req.get('origin'));
        console.log('Request host:', req.get('host'));
        
        const { readingLevel, categories, language, title } = req.query;
        console.log('Query params:', { readingLevel, categories, language, title });
        
        const filters = {
          ...(readingLevel && { readingLevel: String(readingLevel) }),
          ...(categories && { categories: Array.isArray(categories) ? categories.map(String) : [String(categories)] }),
          ...(language && { language: String(language) }),
          ...(title && { title: String(title) })
        };
        console.log('Applying filters:', filters);
        
        console.log('🔍 Fetching stories from database...');
        const stories = await mongoStoryService.getStories(filters);
        console.log(`✅ Stories found: ${stories.length}`);

        // Fix pdfUrl and categories for each story
        // Use environment variable for production URL, or detect from request
        const getBaseUrl = () => {
          if (process.env.API_BASE_URL) {
            return process.env.API_BASE_URL;
          }
          if (isProduction) {
            // Try to get from request host, or use default
            const host = req.get('host');
            const protocol = req.protocol || 'https';
            if (host) {
              return `${protocol}://${host}`;
            }
            return 'https://phileread-api.onrender.com'; // Default production URL
          }
          return `http://localhost:${PORT}`;
        };

        const baseUrl = getBaseUrl();
        console.log('Using baseUrl for PDF URLs:', baseUrl);

        const fixedStories = stories.map(story => {
          // Ensure categories is always an array of strings
          let categories: string[] = [];
          if (Array.isArray(story.categories)) {
            categories = story.categories.filter((cat): cat is string => typeof cat === 'string');
          }

          return {
            ...story.toObject(),
            pdfUrl: `${baseUrl}/api/stories/${story._id}/pdf`,
            categories,
            hasPdf: !!(story.pdfData || story.pdfFileId)
          };
        });

        res.json(fixedStories);
      } catch (error) {
        console.error('Detailed error in /api/stories:', error);
        res.status(500).json({ 
          error: 'Failed to fetch stories',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Lightweight count endpoint for frontend KPI
    app.get('/api/stories/count', async (_req: Request, res: Response) => {
      try {
        const total = await Story.countDocuments({ isActive: true });
        res.json({ total });
      } catch (error) {
        console.error('Error counting stories:', error);
        res.status(500).json({ error: 'Failed to count stories' });
      }
    });

    app.get('/api/stories/:id', async (req: Request, res: Response) => {
      try {
        const story = await mongoStoryService.getStoryById(req.params.id);
        if (!story) {
          res.status(404).json({ error: 'Story not found' });
          return;
        }
        
        // Add hasPdf field
        const storyWithPdfInfo = {
          ...story.toObject(),
          hasPdf: !!(story.pdfData || story.pdfFileId)
        };
        
        res.json(storyWithPdfInfo);
      } catch (error) {
        console.error('Error fetching story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
      }
    });

    // Commenting out the /api/test-pdf/:id endpoint to avoid missing PDF file error
    // app.get('/api/test-pdf/:id', async (req: Request, res: Response) => {
    //   try {
    //     console.log('Test PDF endpoint called for story ID:', req.params.id);
    //     if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    //       res.status(400).json({ error: 'Invalid story ID format' });
    //       return;
    //     }
    //     const story = await Story.findById(req.params.id).lean();
    //     if (!story) {
    //       res.status(404).json({ error: 'Story not found' });
    //       return;
    //     }
    //     if (story.pdfFileId) {
    //       try {
    //         const { buffer } = await mongoStoryService.getPDFContent(story._id.toString());
    //         const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    //         res.json({
    //           success: true,
    //           bufferSize: pdfBuffer.length,
    //           bufferType: typeof pdfBuffer,
    //           isBuffer: Buffer.isBuffer(pdfBuffer),
    //           first20BytesHex: pdfBuffer.slice(0, 20).toString('hex'),
    //           first10Chars: pdfBuffer.slice(0, 10).toString(),
    //           pdfHeader: pdfBuffer.slice(0, 4).toString(),
    //           hasValidHeader: pdfBuffer.slice(0, 4).toString().startsWith('%PDF')
    //         });
    //       } catch (err) {
    //         res.status(500).json({ 
    //           error: 'Failed to get PDF content',
    //           details: err instanceof Error ? err.message : 'Unknown error'
    //         });
    //       }
    //     } else {
    //       res.status(404).json({ error: 'No PDF file ID found' });
    //     }
    //   } catch (error) {
    //     console.error('Test PDF endpoint error:', error);
    //     res.status(500).json({ error: 'Test failed' });
    //   }
    // });

    app.get('/api/stories/:id/pdf', async (req: Request, res: Response) => {
      try {
        console.log('PDF endpoint called for story ID:', req.params.id);
        
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          console.error('Invalid story ID format:', req.params.id);
          res.status(400).json({ error: 'Invalid story ID format' });
          return;
        }

        // Use lean() to get plain JavaScript object
        const story = await Story.findById(req.params.id).lean();
        console.log('Story found:', {
          id: story?._id,
          title: story?.title,
          hasPdfFileId: !!story?.pdfFileId,
          hasPdfData: !!story?.pdfData,
          pdfDataLength: story?.pdfData?.length,
          pdfDataStart: story?.pdfData?.toString().substring(0, 50)  // Log first 50 chars of PDF data
        });

        if (!story) {
          console.error('Story not found:', req.params.id);
          res.status(404).json({ error: 'Story not found' });
          return;
        }

        if (story.pdfFileId) {
          // Stream directly from GridFS to avoid any buffer/header corruption
          try {
            const stream = await GridFSService.createReadStream(story.pdfFileId.toString());
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="story.pdf"');
            stream.on('error', (e: any) => {
              console.error('GridFS stream error:', e);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream PDF from storage' });
              }
            });
            stream.pipe(res);
            return;
          } catch (err) {
            console.error('Error creating GridFS stream:', err);
            res.status(500).json({ error: 'Failed to fetch PDF from storage' });
            return;
          }
        } else if (story.pdfData) {
          // serve the PDF from pdfData
          const buffer = Buffer.isBuffer(story.pdfData)
            ? story.pdfData
            : Buffer.from(story.pdfData, 'base64');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename=\"story.pdf\"');
          res.send(buffer);
          return;
        } else {
          res.status(404).json({ error: 'No PDF found for this story' });
        }
      } catch (error) {
        console.error('Detailed error serving PDF:', error);
        if (error instanceof Error) {
          console.error('Error stack:', error.stack);
        }
        res.status(500).json({ 
          error: 'Failed to serve PDF',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.post('/api/stories', upload.single('pdf'), async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'PDF file is required' });
          return;
        }

        const { title, description, language, createdBy, readingLevel, categories, grade, storySet } = req.body;
        
        // Log received data for debugging
        console.log('🔍 Backend received story data:', {
          title: title,
          grade: grade,
          storySet: storySet,
          'grade type': typeof grade,
          'storySet type': typeof storySet,
          'req.body keys': Object.keys(req.body)
        });

        // Validate required fields
        const missingFields = [];
        if (!title) missingFields.push('title');
        if (!description) missingFields.push('description');

        if (missingFields.length > 0) {
          res.status(400).json({ 
            error: 'Missing required fields', 
            missingFields,
            receivedData: req.body 
          });
          return;
        }

        // Parse categories if it's a string
        let parsedCategories;
        try {
          parsedCategories = categories ? JSON.parse(categories) : undefined;
        } catch (error) {
          console.warn('Failed to parse categories:', error);
          parsedCategories = undefined;
        }

        // Verify the file
        if (!req.file.buffer) {
          throw new Error('File buffer is missing');
        }

        // Check if it's a valid PDF (only for PDF files, skip for text files)
        if (req.file.mimetype === 'application/pdf') {
          const pdfHeader = req.file.buffer.slice(0, 4).toString();
          if (!pdfHeader.startsWith('%PDF')) {
            console.error('Invalid PDF header:', pdfHeader);
            res.status(400).json({ error: 'Invalid PDF file: Missing PDF header' });
            return;
          }
        } else if (req.file.mimetype === 'text/plain') {
          // For text files (manual input), no header validation needed
          console.log('Processing text file for manual story input');
        }

        const storyData = {
          title: title.trim(),
          description: description.trim(),
          language: language || 'english',
          createdBy,
          readingLevel,
          categories: parsedCategories,
          grade: grade || '3',  // Default to grade 3 if not provided
          storySet: storySet,  // Can be undefined for unassigned stories
          textContent: ''  // Default empty string for text content
        };

        console.log('🔍 Backend storyData to save:', {
          title: storyData.title,
          grade: storyData.grade,
          storySet: storyData.storySet,
          'storyData keys': Object.keys(storyData)
        });



        console.log('Creating story with data:', storyData);
        console.log('File size:', req.file.size, 'bytes');
        console.log('File type:', req.file.mimetype);

        const story = await mongoStoryService.createStory(storyData, req.file.buffer, req.file.mimetype);
        res.status(201).json(story);
        return;
      } catch (error) {
        console.error('Error creating story:', error);
        res.status(400).json({ 
          error: 'Failed to create story',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
      }
    });

    app.put('/api/stories/:id', upload.single('pdf'), async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { title, description, language, readingLevel, categories, isActive } = req.body;
        
        // Only include fields that have actual values (not undefined)
        const updatedStoryData: Partial<IStory> = {};
        if (title !== undefined) updatedStoryData.title = title;
        if (description !== undefined) updatedStoryData.description = description;
        if (language !== undefined) updatedStoryData.language = language;
        if (readingLevel !== undefined) updatedStoryData.readingLevel = readingLevel;
        if (categories !== undefined) updatedStoryData.categories = categories;
        if (isActive !== undefined) updatedStoryData.isActive = isActive === 'true' || isActive === true;
        
        if (req.file) {
          updatedStoryData.pdfData = req.file.buffer;
        }

        // Log received data for debugging
        console.log('Received update data:', {
          id,
          title,
          description,
          language,
          readingLevel,
          categories,
          isActive,
          fileSize: req.file?.size,
          fileName: req.file?.originalname,
          mimeType: req.file?.mimetype
        });
        
        const updatedStory = await mongoStoryService.updateStory(id, updatedStoryData);
        
        if (!updatedStory) {
          res.status(404).json({ error: 'Story not found or update failed.' });
          return;
        }
        res.json(updatedStory);
        return;
      } catch (error) {
        console.error('Error updating story:', error);
        res.status(500).json({ error: 'Failed to update story' });
        return;
      }
    });

    app.delete('/api/stories/:id', async (req: Request, res: Response) => {
      try {
        const storyId = req.params.id;
        console.log(`🗑️ DELETE /api/stories/${storyId} - Starting deletion process`);
        
        // Delete associated tests/quizzes from Firebase
        try {
          console.log(`🔍 Searching for tests with storyId: ${storyId}`);
          const testsQuery = query(collection(firestore, 'tests'), where('storyId', '==', storyId));
          const testsSnapshot = await getDocs(testsQuery);
          
          console.log(`📊 Found ${testsSnapshot.size} test(s) associated with story ${storyId}`);
          
          if (testsSnapshot.size > 0) {
            // Log the test details for debugging
            testsSnapshot.docs.forEach(testDoc => {
              const testData = testDoc.data();
              console.log(`  - Test ID: ${testDoc.id}, Test Name: ${testData.testName}, Story ID: ${testData.storyId}`);
            });
          }
          
          // Delete each test
          for (const testDoc of testsSnapshot.docs) {
            await deleteDoc(doc(firestore, 'tests', testDoc.id));
            console.log(`✅ Deleted test ${testDoc.id} for story ${storyId}`);
          }
        } catch (firebaseError) {
          console.error('❌ Error deleting associated tests from Firebase:', firebaseError);
          // Continue with story deletion even if Firebase deletion fails
        }
        
        // Delete the story from MongoDB
        console.log(`🗄️ Deleting story from MongoDB: ${storyId}`);
        await mongoStoryService.deleteStory(storyId);
        console.log(`✅ Story ${storyId} deleted successfully`);
        res.status(204).send(); // No Content
        return;
      } catch (error) {
        console.error('Error deleting story:', error);
        res.status(500).json({ error: 'Failed to delete story' });
        return;
      }
    });

    app.get('/api/stories/search', async (req: Request, res: Response) => {
      try {
        const { searchTerm } = req.query;
        if (!searchTerm) {
          res.status(400).json({ error: 'Search term is required' });
          return;
        }
        const stories = await mongoStoryService.searchStories(String(searchTerm));
        res.json(stories);
        return;
      } catch (error) {
        console.error('Error searching stories:', error);
        res.status(500).json({ error: 'Failed to search stories' });
        return;
      }
    });

    // Upload audio for a session
    app.post('/api/sessions/:id/audio', audioUpload.single('audio'), async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No audio file uploaded' });
          return;
        }
        const sessionId = req.params.id;
        // Save to GridFS
        const audioFileId = await GridFSService.uploadFile(
          req.file.buffer,
          `session-${sessionId}-${Date.now()}.webm`, // or .wav/.mp3
          { contentType: req.file.mimetype, sessionId }
        );
        // Optionally, save audioFileId to the session document if you have a Session model
        // await Session.findByIdAndUpdate(sessionId, { audioFileId });
        res.json({ success: true, audioFileId });
        return;
      } catch (error) {
        console.error('Audio upload error:', error);
        res.status(500).json({ error: 'Failed to upload audio' });
        return;
      }
    });

    // Retrieve audio for a session
    app.get('/api/sessions/:id/audio', async (req, res) => {
      try {
        // For demo, get audioFileId from query param
        const audioFileId = req.query.audioFileId as string;
        if (!audioFileId) {
          res.status(400).json({ error: 'audioFileId required' });
          return;
        }
        const { buffer, metadata } = await GridFSService.downloadFile(audioFileId);
        res.setHeader('Content-Type', metadata.contentType || 'audio/webm');
        res.setHeader('Content-Disposition', 'inline');
        res.send(buffer);
        return;
      } catch (error) {
        console.error('Audio fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch audio' });
        return;
      }
    });

    app.get('/api/results/teacher/:teacherId', async (req: Request, res: Response) => {
      try {
        const results = await resultService.getResultsByTeacher(req.params.teacherId);
        res.json(results);
      } catch (error) {
        console.error('Error fetching teacher results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
      }
    });

    app.get('/api/results/student/:studentId', async (req: Request, res: Response) => {
      try {
        const results = await resultService.getResultsByStudent(req.params.studentId);
        res.json(results);
      } catch (error) {
        console.error('Error fetching student results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
      }
    });

    app.get('/api/results/combined/:studentId', async (req: Request, res: Response) => {
      try {
        const results = await resultService.getResultsByStudent(req.params.studentId);
        if (!results) {
          res.json([]); // Always return 200 with an array
          return;
        }
        // Sort by createdAt descending
        const sorted = results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(sorted);
      } catch (error) {
        console.error('Error fetching combined results:', error);
        res.status(500).json({ error: 'Failed to fetch combined results' });
      }
    });

    app.get('/api/results/:id', async (req: Request, res: Response) => {
      try {
        const result = await resultService.getResultById(req.params.id);
        if (!result) {
          res.status(404).json({ error: 'Result not found' });
          return;
        }
        res.json(result);
      } catch (error) {
        console.error('Error fetching result by ID:', error);
        res.status(500).json({ error: 'Failed to fetch result' });
      }
    });

    // --- ISR Results API ---
    // Test endpoint to verify routing
    app.get('/api/isr-results/test', (req: Request, res: Response) => {
      res.json({ message: 'ISR Results API is working!', timestamp: new Date().toISOString() });
    });

    app.post('/api/isr-results', async (req: Request, res: Response) => {
      try {
        console.log('📝 POST /api/isr-results - Received data:', {
          body: req.body,
          hasStudentId: !!req.body.studentId,
          hasTeacherId: !!req.body.teacherId,
          hasPartA: !!req.body.partA,
          hasPartB: !!req.body.partB,
        });

        // Validate required fields
        if (!req.body.studentId) {
          res.status(400).json({ 
            error: 'Missing required field: studentId',
            receivedData: Object.keys(req.body)
          });
          return;
        }

        if (!req.body.teacherId) {
          res.status(400).json({ 
            error: 'Missing required field: teacherId',
            receivedData: Object.keys(req.body)
          });
          return;
        }

        if (!req.body.partA) {
          res.status(400).json({ 
            error: 'Missing required field: partA',
            receivedData: Object.keys(req.body)
          });
          return;
        }

        if (!req.body.partB) {
          res.status(400).json({ 
            error: 'Missing required field: partB',
            receivedData: Object.keys(req.body)
          });
          return;
        }

        // Save to MongoDB
        const result = await isrResultService.createISRResult(req.body);
        console.log('✅ ISR Result saved to MongoDB:', result._id);

        try {
          await isrReviewRecordService.upsertFromISRResult(result);
          console.log('📘 ISR review record updated for student:', result.studentId);
        } catch (reviewError) {
          console.error('❌ Failed to update ISR review record:', reviewError);
        }

        res.status(201).json(result);
        return;
      } catch (error) {
        console.error('❌ Error saving ISR result:', error);
        
        if (error instanceof Error) {
          // Check for validation errors
          if (error.name === 'ValidationError') {
            res.status(400).json({ 
              error: 'Validation error',
              details: error.message,
              validationErrors: (error as any).errors
            });
            return;
          }
          
          // Check for duplicate key errors
          if ((error as any).code === 11000) {
            res.status(400).json({ 
              error: 'Duplicate entry',
              details: error.message
            });
            return;
          }

          res.status(500).json({ 
            error: 'Failed to save ISR result',
            details: error.message,
            errorName: error.name
          });
          return;
        }

        res.status(500).json({ 
          error: 'Failed to save ISR result',
          details: 'Unknown error occurred'
        });
        return;
      }
    });

    app.get('/api/isr-results/student/:studentId', async (req: Request, res: Response): Promise<void> => {
      try {
        const studentId = req.params.studentId;
        const studentName = req.query.studentName as string | undefined; // Optional query parameter
        
        if (!studentId || studentId.trim() === '') {
          console.warn('⚠️ Empty studentId provided to /api/isr-results/student/:studentId');
          res.status(400).json({ error: 'Student ID is required' });
          return;
        }

        console.log(`🔍 API: Fetching ISR results for student: ${studentId}${studentName ? ` (Name: ${studentName})` : ''}`);
        const results = await isrResultService.getISRResultsByStudent(studentId, studentName);
        
        console.log(`✅ API: Returning ${results.length} ISR result(s) for student ${studentId}`);
        res.json(results);
      } catch (error) {
        console.error('❌ API Error fetching ISR results by student:', error);
        if (error instanceof Error) {
          res.status(500).json({ 
            error: 'Failed to fetch ISR results',
            details: error.message 
          });
        } else {
          res.status(500).json({ error: 'Failed to fetch ISR results' });
        }
      }
    });

    app.get('/api/isr-results/teacher/:teacherId', async (req: Request, res: Response) => {
      try {
        const results = await isrResultService.getISRResultsByTeacher(req.params.teacherId);
        res.json(results);
      } catch (error) {
        console.error('Error fetching ISR results by teacher:', error);
        res.status(500).json({ error: 'Failed to fetch ISR results' });
      }
    });

    app.get('/api/isr-results/:id', async (req: Request, res: Response) => {
      try {
        const result = await isrResultService.getISRResultById(req.params.id);
        if (!result) {
          res.status(404).json({ error: 'ISR result not found' });
          return;
        }
        res.json(result);
      } catch (error) {
        console.error('Error fetching ISR result by ID:', error);
        res.status(500).json({ error: 'Failed to fetch ISR result' });
      }
    });

    // Calculate ISR Review entry from ISR Result ID
    app.get('/api/isr-results/:id/calculate', async (req: Request, res: Response) => {
      try {
        const result = await isrResultService.getISRResultById(req.params.id);
        if (!result) {
          res.status(404).json({ error: 'ISR result not found' });
          return;
        }
        
        // Use the calculator to compute the ISR review entry
        const calculated = calculateFromISRResult(result);
        
        res.json({
          isrResult: result,
          calculatedEntry: calculated
        });
      } catch (error) {
        console.error('Error calculating ISR review entry:', error);
        res.status(500).json({ error: 'Failed to calculate ISR review entry' });
      }
    });

    app.put('/api/isr-results/:id', async (req: Request, res: Response) => {
      try {
        const result = await isrResultService.updateISRResult(req.params.id, req.body);
        if (!result) {
          res.status(404).json({ error: 'ISR result not found' });
          return;
        }

        try {
          await isrReviewRecordService.upsertFromISRResult(result);
        } catch (reviewError) {
          console.error('❌ Failed to update ISR review record on update:', reviewError);
        }

        res.json(result);
      } catch (error) {
        console.error('Error updating ISR result:', error);
        
        if (error instanceof Error && error.name === 'ValidationError') {
          res.status(400).json({ 
            error: 'Validation error',
            details: error.message,
            validationErrors: (error as any).errors
          });
          return;
        }

        res.status(500).json({ error: 'Failed to update ISR result' });
      }
    });

    app.delete('/api/isr-results/:id', async (req: Request, res: Response) => {
      try {
        const deleted = await isrResultService.deleteISRResult(req.params.id);
        if (!deleted) {
          res.status(404).json({ error: 'ISR result not found' });
          return;
        }
        res.json({ message: 'ISR result deleted successfully' });
      } catch (error) {
        console.error('Error deleting ISR result:', error);
        res.status(500).json({ error: 'Failed to delete ISR result' });
      }
    });

    app.get('/api/isr-review-records/student/:studentId', async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        const { sync } = req.query; // Optional: ?sync=true to rebuild from all ISR results
        
        // If sync is requested, rebuild from all ISR results
        if (sync === 'true') {
          console.log(`🔄 Syncing review record for student ${studentId} from all ISR results...`);
          const allResults = await isrResultService.getISRResultsByStudent(studentId);
          
          if (allResults.length > 0) {
            const record = await isrReviewRecordService.rebuildFromAllISRResults(studentId, allResults);
            res.json(record);
            return;
          } else {
            console.log(`⚠️ No ISR results found for student ${studentId}, returning empty record`);
          }
        }
        
        // Otherwise, get or create the review record
        const record = await isrReviewRecordService.getOrCreateResponse(studentId);
        
        // Auto-sync if record exists but has no entries (might be stale)
        if (record.entries && record.entries.length > 0 && !record.entries.some(e => e.dateTaken)) {
          console.log(`🔄 Auto-syncing review record for student ${studentId} (no entries with data)`);
          const allResults = await isrResultService.getISRResultsByStudent(studentId);
          if (allResults.length > 0) {
            const syncedRecord = await isrReviewRecordService.rebuildFromAllISRResults(studentId, allResults);
            res.json(syncedRecord);
            return;
          }
        }
        
        res.json(record);
      } catch (error) {
        console.error('Error fetching ISR review record:', error);
        res.status(500).json({ error: 'Failed to fetch ISR review record' });
      }
    });

    // Endpoint to manually sync/rebuild review record from all ISR results
    app.post('/api/isr-review-records/student/:studentId/sync', async (req: Request, res: Response) => {
      try {
        const { studentId } = req.params;
        console.log(`🔄 Manual sync requested for student ${studentId}`);
        
        const allResults = await isrResultService.getISRResultsByStudent(studentId);
        
        if (allResults.length === 0) {
          res.status(404).json({ 
            error: 'No ISR results found for this student',
            studentId 
          });
          return;
        }
        
        const record = await isrReviewRecordService.rebuildFromAllISRResults(studentId, allResults);
        
        res.json({
          success: true,
          message: `Review record synced from ${allResults.length} ISR results`,
          record,
          processedResults: allResults.length
        });
      } catch (error) {
        console.error('Error syncing ISR review record:', error);
        res.status(500).json({ error: 'Failed to sync ISR review record' });
      }
    });

    app.use('/api/teachers', teacherRoutes);
    app.use('/api/parents', parentRoutes);
    const ADMIN_REPORTS_ENABLED = process.env.ADMIN_REPORTS_ENABLED === 'true';
    if (ADMIN_REPORTS_ENABLED) {
      console.log('Administrative Reports routes enabled');
      app.use('/api/reports', reportRoutes);
      startScheduledReportRunner();
    }
    
    // Use admin routes
    app.use('/api/admin', adminRoutes);

    // Removed OpenAI Whisper transcription route; using external Python Vosk WS instead

    // Start the server only after all routes are registered
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`ISR Results API available at: http://localhost:${PORT}/api/isr-results`);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB or initialize GridFS:', error);
    process.exit(1);
  }
})();