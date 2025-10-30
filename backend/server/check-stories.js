const mongoose = require('mongoose');
require('dotenv').config();

async function checkStories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const stories = await db.collection('stories').find({}).toArray();
    
    console.log(`Found ${stories.length} stories in database:`);
    stories.forEach(story => {
      console.log('Story:', {
        title: story.title,
        grade: story.grade,
        storySet: story.storySet,
        hasPdfData: !!story.pdfData,
        pdfDataLength: story.pdfData ? story.pdfData.length : 0,
        hasPdfFileId: !!story.pdfFileId,
        _id: story._id
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStories();