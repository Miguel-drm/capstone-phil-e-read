#!/usr/bin/env python3
"""
Timing Validator - Detects and corrects Vosk timing delays

This module works alongside the word matcher to detect when Vosk
is lagging behind the reader and automatically corrects matches.

Example:
    Reader says: "Pam has a cat"
    Vosk hears (delayed): "on the bed" (from 5 words later)
    Timing Validator: Detects the lag and corrects the matches
"""

from typing import List, Dict, Optional, Tuple
import time


class TimingValidator:
    """
    Validates word timing and detects Vosk delays.
    
    This class tracks the timing of recognized words and compares them
    to expected reading speed to detect when Vosk is lagging.
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        """
        Initialize timing validator.
        
        Args:
            expected_words: List of expected words in order
            language: Language for pronunciation matching
        """
        self.expected_words = expected_words
        self.language = language
        self.word_timestamps = []  # List of (word, timestamp, position) tuples
        self.session_start_time = time.time()
        
        # Timing thresholds
        self.min_word_interval = 0.15  # Minimum 150ms between words (very fast reading)
        self.max_word_interval = 2.0   # Maximum 2s between words (normal reading)
        self.expected_wpm = 100        # Expected reading speed (words per minute)
        
        # Lag detection
        self.lag_threshold = 3         # If Vosk is 3+ words behind, it's lagging
        self.last_correction_time = 0
        self.correction_cooldown = 1.0 # Wait 1s between corrections
    
    def add_word(self, word: str, position: int, timestamp: Optional[float] = None):
        """
        Add a recognized word with its timestamp.
        
        Args:
            word: Recognized word
            position: Position in expected words
            timestamp: Time when word was recognized (default: now)
        """
        if timestamp is None:
            timestamp = time.time()
        
        self.word_timestamps.append((word, timestamp, position))
    
    def detect_lag(self, current_position: int, recognized_position: int) -> Tuple[bool, int]:
        """
        Detect if Vosk is lagging behind the reader.
        
        Args:
            current_position: Current position in story (where reader should be)
            recognized_position: Position of word Vosk just recognized
            
        Returns:
            Tuple of (is_lagging, estimated_lag_words)
        """
        # Calculate lag in words
        lag_words = recognized_position - current_position
        
        # If Vosk is recognizing words from the past, it's lagging
        if lag_words < -self.lag_threshold:
            return (True, abs(lag_words))
        
        return (False, 0)
    
    def estimate_current_position(self) -> int:
        """
        Estimate where the reader should be based on timing.
        
        Returns:
            Estimated current position in story
        """
        if len(self.word_timestamps) < 2:
            return 0
        
        # Calculate average reading speed from recent words
        recent_words = self.word_timestamps[-5:]  # Last 5 words
        if len(recent_words) < 2:
            return recent_words[-1][2] if recent_words else 0
        
        # Calculate time span and words read
        time_span = recent_words[-1][1] - recent_words[0][1]
        words_read = len(recent_words)
        
        if time_span > 0:
            # Calculate WPM
            wpm = (words_read / time_span) * 60
            
            # Estimate how many words should have been read by now
            elapsed = time.time() - self.session_start_time
            estimated_words = int((wpm / 60) * elapsed)
            
            return min(estimated_words, len(self.expected_words) - 1)
        
        return recent_words[-1][2]
    
    def correct_position(self, recognized_word: str, matched_position: int, current_position: int) -> Dict:
        """
        Correct a word match if timing indicates Vosk is lagging.
        
        Args:
            recognized_word: Word that Vosk recognized
            matched_position: Position where word was matched
            current_position: Current position in story
            
        Returns:
            Correction result dictionary
        """
        # Check if we're in cooldown
        current_time = time.time()
        if current_time - self.last_correction_time < self.correction_cooldown:
            return {
                "corrected": False,
                "reason": "cooldown",
                "original_position": matched_position,
                "corrected_position": matched_position
            }
        
        # Detect lag
        is_lagging, lag_words = self.detect_lag(current_position, matched_position)
        
        if is_lagging:
            # Vosk is lagging - the word it recognized is from the past
            # Estimate where the reader actually is
            estimated_position = self.estimate_current_position()
            
            # Check if the recognized word matches the estimated position
            if estimated_position < len(self.expected_words):
                expected_at_estimated = self.expected_words[estimated_position].lower()
                recognized_lower = recognized_word.lower()
                
                # Simple similarity check
                if self._words_similar(recognized_lower, expected_at_estimated):
                    # Correction successful!
                    self.last_correction_time = current_time
                    
                    print(f"   🔧 TIMING CORRECTION: Vosk lagging by {lag_words} words")
                    print(f"      Recognized: '{recognized_word}' at position {matched_position}")
                    print(f"      Corrected to position {estimated_position}")
                    
                    return {
                        "corrected": True,
                        "reason": "lag_detected",
                        "original_position": matched_position,
                        "corrected_position": estimated_position,
                        "lag_words": lag_words
                    }
        
        return {
            "corrected": False,
            "reason": "no_lag",
            "original_position": matched_position,
            "corrected_position": matched_position
        }
    
    def _words_similar(self, word1: str, word2: str) -> bool:
        """
        Check if two words are similar enough to be considered a match.
        
        Args:
            word1: First word
            word2: Second word
            
        Returns:
            True if words are similar
        """
        # Exact match
        if word1 == word2:
            return True
        
        # Length difference check
        if abs(len(word1) - len(word2)) > 2:
            return False
        
        # Character overlap check
        common_chars = sum(1 for c in word1 if c in word2)
        min_len = min(len(word1), len(word2))
        
        if min_len > 0:
            similarity = common_chars / min_len
            return similarity >= 0.7
        
        return False
    
    def get_stats(self) -> Dict:
        """
        Get timing statistics.
        
        Returns:
            Dictionary with timing stats
        """
        if not self.word_timestamps:
            return {
                "words_tracked": 0,
                "average_wpm": 0,
                "session_duration": 0
            }
        
        # Calculate average WPM
        session_duration = time.time() - self.session_start_time
        words_tracked = len(self.word_timestamps)
        
        average_wpm = 0
        if session_duration > 0:
            average_wpm = int((words_tracked / session_duration) * 60)
        
        return {
            "words_tracked": words_tracked,
            "average_wpm": average_wpm,
            "session_duration": round(session_duration, 1)
        }
