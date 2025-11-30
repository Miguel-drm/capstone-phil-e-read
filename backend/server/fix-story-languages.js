/**
 * Script to fix story language fields in the database
 * Converts 'none' to 'english' for English stories
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/philiready';

async function fixStoryLanguages() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Story = mongoose.model('Story', new mongoose.Schema({}, { strict: false }));

    // Find all stories with language 'none' or null
    const stories = await Story.find({
      $or: [
        { language: 'none' },
        { language: null },
        { language: { $exists: false } }
      ]
    });

    console.log(`\nFound ${stories.length} stories with language 'none' or null`);

    if (stories.length === 0) {
      console.log('No stories to update.');
      await mongoose.disconnect();
      return;
    }

    // Show stories that will be updated
    console.log('\nStories to update:');
    stories.forEach((story, index) => {
      console.log(`${index + 1}. "${story.title}" - current language: ${story.language || 'null'}`);
    });

    // Update all to 'english'
    const result = await Story.updateMany(
      {
        $or: [
          { language: 'none' },
          { language: null },
          { language: { $exists: false } }
        ]
      },
      { $set: { language: 'english' } }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} stories to language: 'english'`);
    console.log('\nNote: If any of these stories are actually in Tagalog, please update them manually through the admin interface.');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixStoryLanguages();
