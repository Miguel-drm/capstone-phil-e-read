// Firebase Data Migration Script
// Run this in your browser console while on your Firebase project

// First, make sure you're logged into Firebase and have the Firestore database open
// Then paste this script into the browser console

async function migrateClassGrades() {
  try {
    console.log('🚀 Starting Firebase data migration...');
    
    // Get the current Firebase app instance
    const { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Initialize Firestore (assuming you have Firebase already initialized)
    const db = getFirestore();
    
    // Get all documents from classGrades collection
    const classGradesRef = collection(db, 'classGrades');
    const snapshot = await getDocs(classGradesRef);
    
    if (snapshot.empty) {
      console.log('No documents found in classGrades collection.');
      return;
    }
    
    console.log(`📄 Found ${snapshot.size} documents to migrate.`);
    
    const batch = writeBatch(db);
    let updateCount = 0;
    
    snapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const name = data.name || '';
      
      console.log(`Processing: "${name}"`);
      
      // Parse "Grade X - SectionName" format
      const match = name.match(/Grade (\d+) - (.+)/);
      
      if (match) {
        const gradeLevel = parseInt(match[1]);
        const section = match[2].trim();
        
        console.log(`  ✅ Extracted: gradeLevel=${gradeLevel}, section="${section}"`);
        
        // Update the document with new fields
        batch.update(docSnapshot.ref, {
          gradeLevel: gradeLevel,
          section: section
        });
        
        updateCount++;
      } else {
        console.log(`  ⚠️  Skipping: Could not parse name format`);
      }
    });
    
    if (updateCount > 0) {
      console.log(`\n💾 Committing ${updateCount} updates...`);
      await batch.commit();
      console.log('🎉 Migration completed successfully!');
      console.log(`Updated ${updateCount} documents with separate gradeLevel and section fields.`);
    } else {
      console.log('No documents needed updating.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
migrateClassGrades();
