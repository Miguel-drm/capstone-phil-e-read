/**
 * Variant Routes
 * 
 * API endpoints for managing pronunciation variants.
 * Handles adding, removing, and retrieving custom variants for stories.
 */

import express, { Request, Response } from 'express';
import { variantPersistenceService } from '../services/variantPersistenceService.js';

const router = express.Router();

/**
 * POST /api/variants/add
 * Add a custom variant for a word in a story
 * 
 * Body:
 * - word: string - The word
 * - variant: string - The variant pronunciation
 * - storyId: string - The story ID
 * - language: 'english' | 'tagalog' - The language
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { word, variant, storyId, language } = req.body;

    console.log('📝 POST /api/variants/add received:', {
      word,
      variant,
      storyId,
      language,
      bodyKeys: Object.keys(req.body)
    });

    // Validate required fields
    if (!word || !variant || !storyId || !language) {
      console.error('❌ Missing required fields:', {
        word: word ? '✓' : '✗',
        variant: variant ? '✓' : '✗',
        storyId: storyId ? '✓' : '✗',
        language: language ? '✓' : '✗'
      });
      return res.status(400).json({
        error: 'Missing required fields: word, variant, storyId, language',
        received: { word, variant, storyId, language }
      });
    }

    // Validate language
    if (language !== 'english' && language !== 'tagalog') {
      console.error('❌ Invalid language:', language);
      return res.status(400).json({
        error: 'Invalid language. Must be "english" or "tagalog"',
        received: language
      });
    }

    console.log('✅ Validation passed, adding variant...');

    // Add the variant
    await variantPersistenceService.addCustomVariant(word, variant, storyId, language);

    console.log('✅ Variant added successfully');

    res.json({
      success: true,
      message: `Variant added: "${word}" → "${variant}"`
    });
  } catch (error) {
    console.error('Error adding variant:', error);
    res.status(500).json({
      error: 'Failed to add variant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/variants/remove
 * Remove a custom variant for a word in a story
 * 
 * Body:
 * - word: string - The word
 * - variant: string - The variant pronunciation
 * - storyId: string - The story ID
 */
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const { word, variant, storyId } = req.body;

    // Validate required fields
    if (!word || !variant || !storyId) {
      return res.status(400).json({
        error: 'Missing required fields: word, variant, storyId'
      });
    }

    // Remove the variant
    await variantPersistenceService.removeCustomVariant(word, variant, storyId);

    res.json({
      success: true,
      message: `Variant removed: "${word}" → "${variant}"`
    });
  } catch (error) {
    console.error('Error removing variant:', error);
    res.status(500).json({
      error: 'Failed to remove variant',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/variants/story/:storyId
 * Get all variants for a story
 * 
 * Query params:
 * - language: 'english' | 'tagalog' (optional) - Filter by language
 */
router.get('/story/:storyId', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const { language } = req.query;

    if (!storyId) {
      return res.status(400).json({
        error: 'Missing required parameter: storyId'
      });
    }

    let variants;

    if (language && (language === 'english' || language === 'tagalog')) {
      // Get variants for specific language
      variants = await variantPersistenceService.loadStoryVariantsByLanguage(
        storyId,
        language as 'english' | 'tagalog'
      );
    } else {
      // Get all variants for the story
      variants = await variantPersistenceService.loadStoryVariants(storyId);
    }

    // Convert to response format
    const responseVariants = variants.map(v => ({
      word: v.word,
      variant: v.variant,
      language: v.language,
      isBuiltIn: false,
      storyId: v.storyId,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt
    }));

    res.json({
      storyId,
      variants: responseVariants,
      count: responseVariants.length
    });
  } catch (error) {
    console.error('Error loading variants:', error);
    res.status(500).json({
      error: 'Failed to load variants',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/variants/delete-story
 * Delete all variants for a story
 * 
 * Body:
 * - storyId: string - The story ID
 */
router.post('/delete-story', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.body;

    if (!storyId) {
      return res.status(400).json({
        error: 'Missing required field: storyId'
      });
    }

    // Delete all variants for the story
    await variantPersistenceService.deleteStoryVariants(storyId);

    res.json({
      success: true,
      message: `All variants deleted for story: ${storyId}`
    });
  } catch (error) {
    console.error('Error deleting story variants:', error);
    res.status(500).json({
      error: 'Failed to delete story variants',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/variants/count/:storyId
 * Get the count of variants for a story
 */
router.get('/count/:storyId', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;

    if (!storyId) {
      return res.status(400).json({
        error: 'Missing required parameter: storyId'
      });
    }

    const count = await variantPersistenceService.getVariantCount(storyId);

    res.json({
      storyId,
      count
    });
  } catch (error) {
    console.error('Error getting variant count:', error);
    res.status(500).json({
      error: 'Failed to get variant count',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
