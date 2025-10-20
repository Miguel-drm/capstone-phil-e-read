const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./path-to-your-service-account-key.json'); // You'll need to add your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'phileread-capstone'
});

const db = admin.firestore();

async function migrateClassGrades() {
  try {
    console.log('Starting migration of classGrades documents...');
    
    // Get all documents from classGrades collection
    const snapshot = await db.collection('classGrades').get();
    
    if (snapshot.empty) {
      console.log('No documents found in classGrades collection.');
      return;
    }
    
    console.log(`Found ${snapshot.size} documents to migrate.`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = data.name || '';
      
      console.log(`Processing document ${doc.id}: "${name}"`);
      
      // Parse "Grade X - SectionName" format
      const match = name.match(/Grade (\d+) - (.+)/);
      
      if (match) {
        const gradeLevel = parseInt(match[1]);
        const section = match[2].trim();
        
        console.log(`  -> Extracted: gradeLevel=${gradeLevel}, section="${section}"`);
        
        // Update the document with new fields
        batch.update(doc.ref, {
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
      console.log(`Updated ${updateCount} documents with separate gradeLevel and section fields.`);
    } else {
      console.log('No documents needed updating.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateClassGrades();
