import React, { useState, useEffect } from 'react';
import { VariantService } from '../../services/variantService';
import './VariantManager.css';

// Get the singleton instance
const variantService = VariantService.getInstance();

interface VariantManagerProps {
  storyId: string;
  language: 'english' | 'tagalog';
  onVariantAdded?: () => void;
  onVariantRemoved?: () => void;
}

interface DisplayVariant {
  word: string;
  variant: string;
  isBuiltIn: boolean;
}

/**
 * Variant Manager Component
 * 
 * Provides a UI for managing pronunciation variants for stories.
 * Allows teachers to add custom variants and view both built-in and custom variants.
 * 
 * Requirements:
 * - 7.1: Display section showing available variants for words in a story
 * - 7.2: Provide form to enter a word and its variant
 * - 7.3: Validate that both word and variant are non-empty
 * - 7.4: Display confirmation message when variant is added
 * - 7.5: Distinguish between built-in and custom variants
 * - 7.6: Delete button for custom variants
 * - 7.7: Show variants organized by word
 */
export const VariantManager: React.FC<VariantManagerProps> = ({
  storyId,
  language,
  onVariantAdded,
  onVariantRemoved,
}) => {
  const [word, setWord] = useState('');
  const [variant, setVariant] = useState('');
  const [variants, setVariants] = useState<DisplayVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load variants for the story
  useEffect(() => {
    loadVariants();
  }, [storyId, language]);

  const loadVariants = async () => {
    try {
      setLoading(true);
      
      const displayVariants: DisplayVariant[] = [];
      
      // Get built-in variants
      const builtInVariants = language === 'english' 
        ? variantService.getCache().builtInEnglish 
        : variantService.getCache().builtInTagalog;
      
      // Get story-level variants
      const storyVariantsMap = variantService.getCache().storyVariants.get(storyId) || new Map();
      const storyLangVariants = storyVariantsMap.get(language) || new Map();
      
      // Collect all unique words
      const allWords = new Set<string>();
      builtInVariants.forEach((_: Set<string>, word: string) => allWords.add(word));
      storyLangVariants.forEach((_: Set<string>, word: string) => allWords.add(word));
      
      // Build display list
      allWords.forEach((w: string) => {
        const storyVars = storyLangVariants.get(w);
        const builtInVars = builtInVariants.get(w);
        
        // Add story-level variants first
        if (storyVars) {
          storyVars.forEach((v: string) => {
            displayVariants.push({ word: w, variant: v, isBuiltIn: false });
          });
        }
        
        // Add built-in variants
        if (builtInVars) {
          builtInVars.forEach((v: string) => {
            displayVariants.push({ word: w, variant: v, isBuiltIn: true });
          });
        }
      });
      
      setVariants(displayVariants);
      setError(null);
    } catch (err) {
      console.error('Failed to load variants:', err);
      setError('Failed to load variants');
    } finally {
      setLoading(false);
    }
  };

  // Validate inputs
  const validateInputs = (): boolean => {
    if (!word.trim()) {
      setError('Word cannot be empty');
      return false;
    }
    if (!variant.trim()) {
      setError('Variant cannot be empty');
      return false;
    }
    return true;
  };

  // Handle adding a new variant
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmation(null);

    if (!validateInputs()) {
      return;
    }

    try {
      setLoading(true);
      await variantService.addCustomVariant(
        word.trim(),
        variant.trim(),
        storyId,
        language
      );

      setConfirmation(`Variant added: "${word}" → "${variant}"`);
      setWord('');
      setVariant('');
      
      // Reload variants
      await loadVariants();
      
      // Call callback
      onVariantAdded?.();

      // Clear confirmation after 3 seconds
      setTimeout(() => setConfirmation(null), 3000);
    } catch (err) {
      console.error('Failed to add variant:', err);
      setError('Failed to add variant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a custom variant
  const handleDeleteVariant = async (w: string, v: string) => {
    try {
      setLoading(true);
      await variantService.removeCustomVariant(w, v, storyId);
      
      setConfirmation(`Variant removed: "${w}" → "${v}"`);
      
      // Reload variants
      await loadVariants();
      
      // Call callback
      onVariantRemoved?.();

      // Clear confirmation after 3 seconds
      setTimeout(() => setConfirmation(null), 3000);
    } catch (err) {
      console.error('Failed to delete variant:', err);
      setError('Failed to delete variant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Group variants by word
  const groupedVariants = variants.reduce((acc, v) => {
    if (!acc[v.word]) {
      acc[v.word] = [];
    }
    acc[v.word].push(v);
    return acc;
  }, {} as Record<string, DisplayVariant[]>);

  return (
    <div className="variant-manager">
      <div className="variant-manager-header">
        <h3>Pronunciation Variants</h3>
        <button
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="variant-manager-content">
          {/* Add Variant Form */}
          <form className="variant-form" onSubmit={handleAddVariant}>
            <div className="form-group">
              <label htmlFor="word-input">Word</label>
              <input
                id="word-input"
                type="text"
                placeholder="Enter word"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="variant-input">Variant</label>
              <input
                id="variant-input"
                type="text"
                placeholder="Enter variant pronunciation"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="add-button"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Variant'}
            </button>
          </form>

          {/* Messages */}
          {error && <div className="error-message">{error}</div>}
          {confirmation && <div className="confirmation-message">{confirmation}</div>}

          {/* Variants List */}
          <div className="variants-list">
            <h4>Available Variants ({variants.length})</h4>
            
            {variants.length === 0 ? (
              <p className="no-variants">No variants available for this story.</p>
            ) : (
              <div className="variants-by-word">
                {Object.entries(groupedVariants).map(([w, variantList]) => (
                  <div key={w} className="word-group">
                    <div className="word-label">{w}</div>
                    <div className="variant-items">
                      {variantList.map((v, idx) => (
                        <div key={idx} className={`variant-item ${v.isBuiltIn ? 'built-in' : 'custom'}`}>
                          <span className="variant-text">{v.variant}</span>
                          <span className="variant-badge">
                            {v.isBuiltIn ? 'Built-in' : 'Custom'}
                          </span>
                          {!v.isBuiltIn && (
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteVariant(w, v.variant)}
                              disabled={loading}
                              title="Delete this custom variant"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantManager;
