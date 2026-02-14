import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import Parent from '../models/Parent.js';
import { db } from '../config/firebase.js';
import { collection, getDocs, query, where, updateDoc, doc, writeBatch } from 'firebase/firestore';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload parent profile image by parentId (firebaseUid)
const uploadProfileImage = async (req: Request, res: Response): Promise<void> => {
	try {
		const { parentId } = req.params;
		if (!req.file) {
			res.status(400).json({ error: 'No image file uploaded' });
			return;
		}
		const imageBase64 = req.file.buffer.toString('base64');
		const parent = await Parent.findOneAndUpdate(
			{ firebaseUid: parentId },
			{ profileImage: imageBase64 },
			{ new: true }
		);
		if (!parent) {
			res.status(404).json({ error: 'Parent not found' });
			return;
		}
		res.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
};

// Get parent profile image by parentId (firebaseUid)
const getProfileImage = async (req: Request, res: Response): Promise<void> => {
	try {
		const { parentId } = req.params;
		const parent = await Parent.findOne({ firebaseUid: parentId });
		if (!parent || !parent.profileImage) {
			res.json({ profileImage: null });
			return;
		}
		res.json({ profileImage: parent.profileImage });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
};

// Get available grades and sections for parent request form
const getGradesAndSections = async (req: Request, res: Response): Promise<void> => {
	try {
		// Get grades 3-6 from Firestore classGrades collection
		const gradesRef = collection(db, 'classGrades');
		const q = query(gradesRef, where('isActive', '==', true));
		const gradesSnapshot = await getDocs(q);
		
		const allGrades = gradesSnapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data()
		}));
		
		// Filter to only Grade 3-6 and handle both old and new data structures
		const filteredGrades = allGrades.filter((grade: any) => {
			// Check if new structure exists (gradeLevel field)
			if (grade.gradeLevel) {
				return grade.gradeLevel >= 3 && grade.gradeLevel <= 6;
			}
			// Fallback to old structure (parsing name field)
			const gradeNumber = parseInt(grade.name?.match(/\d+/)?.[0] || '0');
			return gradeNumber >= 3 && gradeNumber <= 6;
		});
		
		// Group by grade number for sections
		const gradesByNumber: { [key: string]: any[] } = {};
		filteredGrades.forEach((grade: any) => {
			let gradeNumber: string;
			
			// Use new structure if available
			if (grade.gradeLevel) {
				gradeNumber = grade.gradeLevel.toString();
			} else {
				// Fallback to old structure
				gradeNumber = grade.name?.match(/\d+/)?.[0] || '0';
			}
			
			if (gradeNumber && gradeNumber !== '0') {
				if (!gradesByNumber[gradeNumber]) {
					gradesByNumber[gradeNumber] = [];
				}
				gradesByNumber[gradeNumber].push(grade);
			}
		});
		
		// Create response structure
		const response = {
			grades: Object.keys(gradesByNumber).map(gradeNum => ({
				id: `grade${gradeNum}`,
				name: `Grade ${gradeNum}`,
				sections: gradesByNumber[gradeNum].map(grade => ({
					id: grade.id,
					name: grade.name || `${grade.gradeLevel} - ${grade.section}`,
					sectionName: grade.section || grade.name?.split('-')[1]?.trim() || grade.name,
					gradeLevel: grade.gradeLevel || parseInt(grade.name?.match(/\d+/)?.[0] || '0')
				}))
			}))
		};
		
		res.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Error fetching grades and sections:', error);
		res.status(500).json({ error: message });
	}
};

// Migration endpoint to update classGrades documents
const migrateClassGrades = async (req: Request, res: Response): Promise<void> => {
	try {
		console.log('Starting migration of classGrades documents...');
		
		// Get all documents from classGrades collection
		const gradesRef = collection(db, 'classGrades');
		const snapshot = await getDocs(gradesRef);
		
		if (snapshot.empty) {
			res.json({ message: 'No documents found in classGrades collection.', updated: 0 });
			return;
		}
		
		console.log(`Found ${snapshot.size} documents to migrate.`);
		
		const batch = writeBatch(db);
		let updateCount = 0;

		snapshot.docs.forEach(docSnapshot => {
			const data = docSnapshot.data();
			const name = data.name || '';

			console.log(`Processing document ${docSnapshot.id}: "${name}"`);

			// Parse "Grade X - SectionName" format
			const match = name.match(/Grade (\d+) - (.+)/);

			if (match) {
				const gradeLevel = parseInt(match[1]);
				const section = match[2].trim();

				console.log(`  -> Extracted: gradeLevel=${gradeLevel}, section="${section}"`);

				// Update the document with new fields
				const docRef = doc(db, 'classGrades', docSnapshot.id);
				batch.update(docRef, {
					gradeLevel: gradeLevel,
					section: section
				});

				updateCount++;
			} else {
				console.log(`  -> Skipping: Could not parse name format`);
			}
		});

		if (updateCount > 0) {
			console.log(`\nCommitting ${updateCount} updates...`);
			await batch.commit();
			console.log('✅ Migration completed successfully!');
		}
		
		res.json({ 
			message: 'Migration completed successfully!', 
			updated: updateCount,
			total: snapshot.size
		});
		
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Error during migration:', error);
		res.status(500).json({ error: message });
	}
};

router.get('/test', (req: Request, res: Response) => {
	res.json({ message: 'Parent routes are working!' });
});

router.post('/:parentId/profile-image', upload.single('image'), uploadProfileImage);
router.get('/:parentId/profile-image', getProfileImage);
router.get('/grades-sections', getGradesAndSections);
router.post('/migrate-class-grades', migrateClassGrades);

export default router;



