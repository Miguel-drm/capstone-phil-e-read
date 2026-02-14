#!/usr/bin/env python3
"""
Phrase Matcher - High-accuracy phrase-level word matching with miscue detection
Uses SmartBufferMatcher for intelligent word matching and miscue classification
"""

from typing import List, Dict
from smart_buffer_matcher import SmartBufferMatcher


class PhraseMatcherSession:
    """
    Phrase-level matcher that uses SmartBufferMatcher for intelligent matching.
    Provides 85-95% accuracy by buffering words and detecting miscue types.
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        """
        Initialize phrase matcher session.
        
        Args:
            expected_words: List of expected words in order
            language: Language of the story ("english" or "tagalog")
        """
        self.expected_words = expected_words
        self.language = language
        
        # Use SmartBufferMatcher for intelligent matching
        # Buffer size of 80 words handles Vosk's severe reordering
        self.matcher = SmartBufferMatcher(expected_words, buffer_size=80)
        
        print(f"✓ Phrase matcher initialized: {len(expected_words)} words, language={language}")
    
    def process_word(self, word: str) -> Dict:
        """
        Process a recognized word and return match result with miscue detection.
        
        Args:
            word: Word recognized by Vosk
            
        Returns:
            Match result dictionary with:
            - match_type: 'correct', 'buffering', 'mispronunciation', 'omission', 'substitution', 'reversal'
            - new_position: New position in story
            - details: Human-readable description
            - session_state: Current session state (position, words_read, miscues)
        """
        # Add word to buffer and try to match
        result = self.matcher.add_word(word)
        
        if result is None:
            # No result yet (still buffering)
            return {
                "match_type": "buffering",
                "new_position": self.matcher.current_position,
                "details": "Buffering words for intelligent matching",
                "session_state": {
                    "current_position": self.matcher.current_position,
                    "words_read": self.matcher.words_read,
                    "total_miscues": self.matcher.total_miscues
                }
            }
        
        # Add session state to result
        result["session_state"] = {
            "current_position": self.matcher.current_position,
            "words_read": self.matcher.words_read,
            "total_miscues": self.matcher.total_miscues
        }
        
        return result
    
    def get_metrics(self, elapsed_time: float) -> Dict:
        """
        Get current reading metrics.
        
        Args:
            elapsed_time: Elapsed time in seconds
            
        Returns:
            Dictionary with metrics (WPM, accuracy, miscues, etc.)
        """
        return self.matcher.get_metrics(elapsed_time)
    
    def flush_buffer(self) -> List[Dict]:
        """
        Flush remaining words at end of session.
        Marks remaining expected words as omissions.
        
        Returns:
            List of match results for remaining words
        """
        return self.matcher.flush_buffer()
