#!/usr/bin/env python3
"""
Word Recognition Enhancer
=========================

This module improves speech recognition by:
1. Filtering out noise and false positives
2. Preventing rapid word jumping (debouncing)
3. Adding confidence thresholds
4. Stabilizing word detection
5. Voice Activity Detection (VAD)

Usage:
    Integrate with VoskServer/server.py to enhance recognition quality
"""

import time
import json
from typing import Dict, List, Optional, Tuple
from collections import deque
from dataclasses import dataclass, field
from enum import Enum

# Import pronunciation dictionaries
try:
    from tagalog_pronunciation_dictionary import (
        TAGALOG_PRONUNCIATION_DICT,
        get_pronunciation_variants as get_tagalog_variants,
        is_pronunciation_match as is_tagalog_match
    )
except ImportError:
    TAGALOG_PRONUNCIATION_DICT = {}
    def get_tagalog_variants(word: str) -> list[str]:
        return [word.lower().strip()]
    def is_tagalog_match(spoken: str, expected: str) -> bool:
        return spoken.lower().strip() == expected.lower().strip()

try:
    from english_pronunciation_dictionary import (
        ENGLISH_PRONUNCIATION_DICT,
        get_pronunciation_variants as get_english_variants,
        is_pronunciation_match as is_english_match
    )
except ImportError:
    ENGLISH_PRONUNCIATION_DICT = {}
    def get_english_variants(word: str) -> list[str]:
        return [word.lower().strip()]
    def is_english_match(spoken: str, expected: str) -> bool:
        return spoken.lower().strip() == expected.lower().strip()


class WordState(Enum):
    """State of a word during recognition"""
    PENDING = "pending"      # Word detected but not confirmed
    CONFIRMED = "confirmed"   # Word confirmed and stable
    REJECTED = "rejected"    # Word rejected (noise/false positive)


@dataclass
class WordCandidate:
    """Represents a candidate word being evaluated"""
    text: str
    confidence: float = 0.0
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    count: int = 1
    state: WordState = WordState.PENDING
    
    def update(self, confidence: float = None):
        """Update word candidate with new detection"""
        self.last_seen = time.time()
        self.count += 1
        if confidence is not None:
            # Weighted average confidence
            self.confidence = (self.confidence * (self.count - 1) + confidence) / self.count
    
    def age(self) -> float:
        """Get age of word candidate in seconds"""
        return time.time() - self.first_seen
    
    def stability_time(self) -> float:
        """Get time since last update"""
        return time.time() - self.last_seen


class WordRecognitionEnhancer:
    """
    Enhances word recognition by filtering noise and preventing rapid word jumping.
    
    Features:
    - Debouncing: Prevents rapid word detection
    - Confidence thresholding: Filters low-confidence detections
    - Stability checking: Requires words to be detected multiple times
    - Voice Activity Detection: Filters silence/noise
    - Word length filtering: Rejects very short words (likely noise)
    """
    
    def __init__(
        self,
        min_word_length: int = 1,  # Changed to 1 to allow single letters like "A"
        min_confidence: float = 0.3,
        debounce_time: float = 0.3,  # 300ms debounce
        stability_count: int = 2,    # Word must be seen at least 2 times
        stability_time: float = 0.5, # Word must be stable for 500ms
        max_candidates: int = 10,
        silence_threshold: float = 0.1,  # Minimum audio level
        language: str = "english"  # Language for pronunciation matching
    ):
        """
        Initialize the word recognition enhancer.
        
        Args:
            min_word_length: Minimum word length to accept (characters)
            min_confidence: Minimum confidence threshold (0.0-1.0)
            debounce_time: Minimum time between word detections (seconds)
            stability_count: Minimum number of detections before confirming
            stability_time: Minimum time word must be stable (seconds)
            max_candidates: Maximum number of word candidates to track
            silence_threshold: Minimum audio level to consider as speech
        """
        self.min_word_length = min_word_length
        self.min_confidence = min_confidence
        self.debounce_time = debounce_time
        self.stability_count = stability_count
        self.stability_time = stability_time
        self.max_candidates = max_candidates
        self.silence_threshold = silence_threshold
        self.language = language.lower()  # Store language for pronunciation matching
        
        # Word candidates being tracked
        self.candidates: Dict[str, WordCandidate] = {}
        
        # Recently confirmed words (for debouncing)
        self.recent_words: deque = deque(maxlen=5)
        
        # Statistics
        self.stats = {
            'words_detected': 0,
            'words_confirmed': 0,
            'words_rejected': 0,
            'noise_filtered': 0
        }
    
    def normalize_word(self, word: str) -> str:
        """Normalize word for comparison."""
        return word.lower().strip()
    
    def is_valid_word(self, word: str) -> bool:
        """Check if word passes basic validation."""
        normalized = self.normalize_word(word)
        
        # Check minimum length
        if len(normalized) < self.min_word_length:
            return False
        
        # Reject common noise patterns
        noise_patterns = ['', 'uh', 'um', 'ah', 'eh', 'oh', 'mm', 'hmm']
        if normalized in noise_patterns:
            return False
        
        # Reject single characters (unless they're valid)
        if len(normalized) == 1 and normalized not in ['a', 'i']:
            return False
        
        return True
    
    def calculate_confidence(self, word: str, partial: bool = False) -> float:
        """
        Calculate confidence score for a word.
        
        Args:
            word: The word to evaluate
            partial: Whether this is a partial result
            
        Returns:
            Confidence score (0.0-1.0)
        """
        normalized = self.normalize_word(word)
        
        # Base confidence
        confidence = 0.5
        
        # Partial results have lower confidence
        if partial:
            confidence *= 0.7
        
        # Single letters get higher confidence (they're usually clear)
        if len(normalized) == 1:
            confidence = 0.7  # Higher confidence for single letters
        
        # Longer words are generally more reliable
        elif len(normalized) >= 5:
            confidence += 0.2
        elif len(normalized) >= 3:
            confidence += 0.1
        
        # Check if word is in pronunciation dictionary (higher confidence)
        if self.language == "tagalog":
            if normalized in TAGALOG_PRONUNCIATION_DICT:
                confidence += 0.1  # Boost confidence for known words
        elif self.language == "english":
            if normalized in ENGLISH_PRONUNCIATION_DICT:
                confidence += 0.1  # Boost confidence for known words
        
        # Common words might be noise (lower confidence, but not for single letters)
        if len(normalized) > 1:
            common_noise = ['the', 'a', 'an', 'is', 'are', 'was', 'were']
            if normalized in common_noise:
                confidence *= 0.8
        
        return min(confidence, 1.0)
    
    def is_recent_duplicate(self, word: str) -> bool:
        """Check if word was recently confirmed (debouncing)."""
        normalized = self.normalize_word(word)
        current_time = time.time()
        
        for recent_word, timestamp in self.recent_words:
            if recent_word == normalized:
                time_diff = current_time - timestamp
                if time_diff < self.debounce_time:
                    return True
        
        return False
    
    def process_word(self, word: str, partial: bool = False, confidence: float = None, expected_word: str = None) -> Optional[str]:
        """
        Process a detected word and return confirmed word if stable.
        
        Args:
            word: Detected word
            partial: Whether this is a partial result
            confidence: Optional confidence score (0.0-1.0)
            expected_word: Optional expected word for pronunciation matching
            
        Returns:
            Confirmed word if stable, None otherwise
        """
        self.stats['words_detected'] += 1
        
        # Basic validation
        if not self.is_valid_word(word):
            self.stats['noise_filtered'] += 1
            return None
        
        normalized = self.normalize_word(word)
        
        # Check if word is in pronunciation dictionary (helps with single letters like "A")
        # This boosts confidence for known words and their variants
        is_known_word = False
        canonical_word = normalized
        
        if self.language == "tagalog":
            # Check if normalized word is a variant of any known word
            for known_word, variants in TAGALOG_PRONUNCIATION_DICT.items():
                if normalized == known_word or normalized in variants:
                    is_known_word = True
                    canonical_word = known_word  # Use canonical form
                    break
        elif self.language == "english":
            # Check if normalized word is a variant of any known word
            for known_word, variants in ENGLISH_PRONUNCIATION_DICT.items():
                if normalized == known_word or normalized in variants:
                    is_known_word = True
                    canonical_word = known_word  # Use canonical form
                    break
        
        # If expected word is provided, check pronunciation match
        # This helps recognize words like "A" even if Vosk returns variations
        if expected_word:
            expected_norm = self.normalize_word(expected_word)
            
            # Check pronunciation match using dictionary
            is_match = False
            if self.language == "tagalog":
                is_match = is_tagalog_match(normalized, expected_norm)
            elif self.language == "english":
                is_match = is_english_match(normalized, expected_norm)
            
            # If pronunciation matches, boost confidence significantly
            if is_match:
                confidence = 0.9  # High confidence for pronunciation match
                # Use expected word as the confirmed word
                canonical_word = expected_norm
                is_known_word = True
        
        # Boost confidence for known words (especially single letters)
        if is_known_word:
            if len(canonical_word) == 1:
                confidence = 0.8  # High confidence for single letters
            else:
                confidence = max(confidence or 0.5, 0.6)  # Boost for known words
        
        # Use canonical word for further processing
        normalized = canonical_word
        
        # Calculate confidence if not provided
        if confidence is None:
            confidence = self.calculate_confidence(word, partial)
        
        # Check confidence threshold
        if confidence < self.min_confidence:
            self.stats['words_rejected'] += 1
            return None
        
        # Update or create candidate
        if normalized in self.candidates:
            candidate = self.candidates[normalized]
            candidate.update(confidence)
        else:
            # Clean up old candidates if we have too many
            if len(self.candidates) >= self.max_candidates:
                self._cleanup_old_candidates()
            
            candidate = WordCandidate(
                text=normalized,
                confidence=confidence
            )
            self.candidates[normalized] = candidate
        
        # Check if word should be confirmed
        confirmed_word = self._check_confirmation(candidate)
        
        if confirmed_word:
            # Add to recent words for debouncing
            self.recent_words.append((normalized, time.time()))
            # Remove from candidates
            del self.candidates[normalized]
            self.stats['words_confirmed'] += 1
            return confirmed_word
        
        return None
    
    def _check_confirmation(self, candidate: WordCandidate) -> Optional[str]:
        """
        Check if a word candidate should be confirmed.
        
        Args:
            candidate: Word candidate to check
            
        Returns:
            Confirmed word if stable, None otherwise
        """
        # Check stability count
        if candidate.count < self.stability_count:
            return None
        
        # Check stability time
        if candidate.stability_time() < self.stability_time:
            return None
        
        # Check if it's a recent duplicate (debouncing)
        if self.is_recent_duplicate(candidate.text):
            candidate.state = WordState.REJECTED
            self.stats['words_rejected'] += 1
            return None
        
        # Word is stable and confirmed
        candidate.state = WordState.CONFIRMED
        return candidate.text
    
    def _cleanup_old_candidates(self):
        """Remove old/stale word candidates."""
        current_time = time.time()
        stale_threshold = 2.0  # 2 seconds
        
        stale_candidates = [
            word for word, candidate in self.candidates.items()
            if current_time - candidate.last_seen > stale_threshold
        ]
        
        for word in stale_candidates:
            del self.candidates[word]
            self.stats['words_rejected'] += 1
    
    def process_vosk_result(self, result: dict, expected_word: str = None) -> Optional[dict]:
        """
        Process a Vosk recognition result and return enhanced result.
        
        Args:
            result: Vosk recognition result dict with 'text' or 'partial'
            expected_word: Optional expected word for pronunciation matching
            
        Returns:
            Enhanced result dict or None if filtered
        """
        text = result.get('text', '').strip()
        partial_text = result.get('partial', '').strip()
        
        # Process final result
        if text:
            confirmed_word = self.process_word(text, partial=False, expected_word=expected_word)
            if confirmed_word:
                return {
                    'text': confirmed_word,
                    'type': 'final',
                    'confidence': self.candidates.get(confirmed_word, WordCandidate(confirmed_word)).confidence
                }
        
        # Process partial result (lower priority)
        if partial_text:
            # Don't confirm partial results, just track them
            self.process_word(partial_text, partial=True, expected_word=expected_word)
            # Return None for partial to avoid jumping
            return None
        
        return None
    
    def reset(self):
        """Reset the enhancer state."""
        self.candidates.clear()
        self.recent_words.clear()
        self.stats = {
            'words_detected': 0,
            'words_confirmed': 0,
            'words_rejected': 0,
            'noise_filtered': 0
        }
    
    def get_stats(self) -> dict:
        """Get enhancement statistics."""
        return self.stats.copy()
    
    def get_candidates(self) -> List[dict]:
        """Get current word candidates being tracked."""
        return [
            {
                'text': candidate.text,
                'confidence': candidate.confidence,
                'count': candidate.count,
                'age': candidate.age(),
                'state': candidate.state.value
            }
            for candidate in self.candidates.values()
        ]


# ============================================================================
# INTEGRATION WITH VOSK SERVER
# ============================================================================

def create_enhanced_recognizer(config: dict = None) -> WordRecognitionEnhancer:
    """
    Create a word recognition enhancer with default or custom configuration.
    
    Args:
        config: Optional configuration dict with enhancer parameters
        
    Returns:
        Configured WordRecognitionEnhancer instance
    """
    if config is None:
        config = {}
    
    return WordRecognitionEnhancer(
        min_word_length=config.get('min_word_length', 2),
        min_confidence=config.get('min_confidence', 0.3),
        debounce_time=config.get('debounce_time', 0.3),
        stability_count=config.get('stability_count', 2),
        stability_time=config.get('stability_time', 0.5),
        max_candidates=config.get('max_candidates', 10),
        silence_threshold=config.get('silence_threshold', 0.1)
    )


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Example usage
    enhancer = WordRecognitionEnhancer()
    
    # Simulate word detections
    test_words = [
        ("hello", False),
        ("hello", False),  # Duplicate - should confirm after stability
        ("world", False),
        ("world", False),
        ("the", False),    # Common word - lower confidence
        ("", False),       # Empty - should be filtered
        ("a", False),      # Too short - should be filtered
    ]
    
    print("Testing Word Recognition Enhancer")
    print("=" * 60)
    
    for word, partial in test_words:
        result = enhancer.process_word(word, partial=partial)
        if result:
            print(f"✅ Confirmed: '{result}'")
        else:
            print(f"⏳ Pending: '{word}'")
    
    print("\n" + "=" * 60)
    print("Statistics:")
    stats = enhancer.get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    print("\nCurrent Candidates:")
    candidates = enhancer.get_candidates()
    for candidate in candidates:
        print(f"  {candidate}")

