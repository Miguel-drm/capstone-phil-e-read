const mongoose = require('mongoose');
require('dotenv').config();

async function fixStories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all stories that don't have grade and storySet
    const stories = await db.collection('stories').find({
      $or: [
        { grade: { $exists: false } },
        { grade: null },
        { grade: undefined },
        { storySet: { $exists: false } },
        { storySet: null },
        { storySet: undefined }
      ]
    }).toArray();
    
    console.log(`Found ${stories.length} stories that need fixing`);
    
    for (const story of stories) {
      console.log(`Fixing story: ${story.title}`);
      
      // For now, assign default values - you can modify this logic
      const defaultGrade = '3';
      const defaultSet = 'A';
      
      await db.collection('stories').updateOne(
        { _id: story._id },
        { 
          $set: { 
            grade: defaultGrade,
            storySet: defaultSet
          }
        }
      );
      
      console.log(`Updated "${story.title}" to Grade ${defaultGrade} Set ${defaultSet}`);
    }
    
    console.log('All stories have been fixed!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixStories();