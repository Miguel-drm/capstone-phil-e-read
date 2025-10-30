const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

async function migrateOldStory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    
    // Find the "tryy again" story with pdfFileId
    const story = await db.collection('stories').findOne({ 
      title: 'tryy again',
      pdfFileId: { $exists: true }
    });
    
    if (!story) {
      console.log('Story not found or already migrated');
      process.exit(0);
    }
    
    console.log('Found story to migrate:', {
      title: story.title,
      pdfFileId: story.pdfFileId
    });
    
    try {
      // Download the PDF from GridFS
      console.log('Downloading PDF from GridFS...');
      const downloadStream = bucket.openDownloadStream(story.pdfFileId);
      
      const chunks = [];
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          console.log('PDF downloaded successfully, size:', pdfBuffer.length);
          
          // Validate PDF
          const pdfHeader = pdfBuffer.slice(0, 4).toString();
          if (!pdfHeader.startsWith('%PDF')) {
            throw new Error('Invalid PDF data');
          }
          
          // Convert to base64
          const pdfBase64 = pdfBuffer.toString('base64');
          console.log('Converted to base64, length:', pdfBase64.length);
          
          // Update the story with base64 data and remove pdfFileId
          const result = await db.collection('stories').updateOne(
            { _id: story._id },
            { 
              $set: { pdfData: pdfBase64 },
              $unset: { pdfFileId: 1 }
            }
          );
          
          console.log('Story updated successfully:', result);
          
          // Delete the GridFS file
          try {
            await bucket.delete(story.pdfFileId);
            console.log('GridFS file deleted successfully');
          } catch (deleteError) {
            console.warn('Could not delete GridFS file:', deleteError.message);
          }
          
          console.log('✅ Migration completed successfully!');
          process.exit(0);
          
        } catch (updateError) {
          console.error('Error updating story:', updateError);
          process.exit(1);
        }
      });
      
      downloadStream.on('error', (error) => {
        console.error('Error downloading from GridFS:', error);
        console.log('This might mean the GridFS file is missing or corrupted');
        
        // If GridFS file is missing, just remove the pdfFileId reference
        db.collection('stories').updateOne(
          { _id: story._id },
          { $unset: { pdfFileId: 1 } }
        ).then(() => {
          console.log('Removed invalid pdfFileId reference');
          process.exit(0);
        });
      });
      
    } catch (gridfsError) {
      console.error('GridFS error:', gridfsError);
      
      // Remove the invalid pdfFileId reference
      await db.collection('stories').updateOne(
        { _id: story._id },
        { $unset: { pdfFileId: 1 } }
      );
      
      console.log('Removed invalid pdfFileId reference');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateOldStory();