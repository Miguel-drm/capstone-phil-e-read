"""
EXTREME SPEED word matcher - minimal overhead, maximum performance.
100% REAL-TIME word-by-word recognition with instant validation.
"""

import time
from typing import Dict, List, Optional
import difflib


def check_pronunciation_match(spoken_word: str, expected_word: str, language: str = "english") -> bool:
    """
    IMPROVED: Multi-level pronunciation matching with language-specific thresholds.
    """
    spoken_lower = spoken_word.lower().strip()
    expected_lower = expected_word.lower().strip()
    
    # Exact match
    if spoken_lower == expected_lower:
        return True
    
    # Language-specific fuzzy matching with enhanced thresholds
    similarity = difflib.SequenceMatcher(None, spoken_lower, expected_lower).ratio()
    
    if language == "tagalog":
        # More lenient for Tagalog (common pronunciation variations)
        return similarity >= 0.60  # Lowered for better Tagalog support
    else:
        # English fuzzy matching with better threshold
        return similarity >= 0.65  # Lowered for better English support
    
    return False


def classify_miscue_type(spoken_word: str, expected_word: str) -> str:
    """
    IMPROVED: Multi-level miscue classification with better thresholds.
    Returns: 'correct', 'mispronunciation', 'substitution', 'reversal'
    """
    spoken_lower = spoken_word.lower().strip()
    expected_lower = expected_word.lower().strip()
    
    if spoken_lower == expected_lower:
        return "correct"
    
    # Check for reversal (letters rearranged)
    if len(spoken_lower) > 2 and len(expected_lower) > 2:
        if sorted(spoken_lower) == sorted(expected_lower):
            return "reversal"
    
    # Improved phonetic similarity (mispronunciation)
    ratio = difflib.SequenceMatcher(None, spoken_lower, expected_lower).ratio()
    
    # More flexible phonetic matching with lower threshold
    if ratio >= 0.55:  # Lowered from 0.60 for better detection
        # Check multiple similarity factors
        same_start = spoken_lower and expected_lower and spoken_lower[0] == expected_lower[0]
        same_end = spoken_lower and expected_lower and spoken_lower[-1] == expected_lower[-1]
        similar_length = abs(len(spoken_lower) - len(expected_lower)) <= 2
        
        # More flexible conditions for mispronunciation
        if same_start or same_end or similar_length:
            return "mispronunciation"
    
    # Check for common sound substitutions (Tagalog/English)
    sound_substitutions = {
        ('p', 'b'), ('t', 'd'), ('k', 'g'), ('f', 'v'), ('s', 'z'),
        ('th', 't'), ('th', 'd'), ('ng', 'n'), ('r', 'l'),
        # Additional English variations
        ('c', 'k'), ('ph', 'f'), ('ck', 'k')
    }
    
    for sound1, sound2 in sound_substitutions:
        if (sound1 in spoken_lower and sound2 in expected_lower) or \
           (sound2 in spoken_lower and sound1 in expected_lower):
            return "mispronunciation"
    
    # Default to substitution
    return "substitution"


class WordMatcherSession:
    """
    EXTREME SPEED word matcher - minimal state tracking.
    100% REAL-TIME: Validates each word instantly and sends result immediately.
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        self.expected_words = expected_words
        self.current_position = 0
        self.words_read = 0
        self.total_miscues = 0
        self.start_time = time.time()
        self.language = language
        
    def process_word(self, spoken_word: str) -> Dict:
        """
        EXTREME SPEED: Minimal processing, instant response.
        100% REAL-TIME: Returns validation result immediately for frontend to color word green.
        
        Returns:
            {
                "type": "word_match",
                "word": spoken_word,
                "expected_word": expected_word,
                "is_correct": bool,
                "position": current_position,
                "advance": bool,
                "new_position": next_position,
                "words_read": total_correct,
                "total_miscues": total_errors,
                "confidence": 1.0,
                "timestamp": server_time
            }
        """
        result = {
            "type": "word_match",
            "word": spoken_word,
            "expected_word": "",
            "is_correct": False,
            "position": self.current_position,
            "advance": False,
            "new_position": self.current_position,
            "words_read": self.words_read,
            "total_miscues": self.total_miscues,
            "confidence": 1.0,
            "timestamp": time.time()
        }
        
        # Check if at end
        if self.current_position >= len(self.expected_words):
            result["expected_word"] = ""
            return result
        
        # Get expected word
        expected_word = self.expected_words[self.current_position]
        result["expected_word"] = expected_word
        
        # IMPROVED COMPARISON: Multi-level matching with context awareness
        is_match = self._advanced_word_match(spoken_word, expected_word)
        
        # Classify miscue type for better feedback
        miscue_type = classify_miscue_type(spoken_word, expected_word)
        
        if is_match:
            # CORRECT WORD ✅
            result["is_correct"] = True
            result["advance"] = True
            result["new_position"] = self.current_position + 1
            result["words_read"] = self.words_read + 1
            result["miscue_type"] = "correct"
            result["miscue_severity"] = "none"
            
            # Debug logging for accurate indexing
            print(f"✅ CORRECT MATCH: '{spoken_word}' == '{expected_word}' at position {self.current_position}")
            print(f"   Advancing: {self.current_position} -> {self.current_position + 1}")
            
            # Update state
            self.current_position += 1
            self.words_read += 1
        else:
            # MISCUE (ERROR) ❌ - Still advance to maintain reading flow
            result["is_correct"] = False
            result["advance"] = True  # Always advance to prevent getting stuck
            result["new_position"] = self.current_position + 1
            result["words_read"] = self.words_read + 1  # Count as attempted word
            result["total_miscues"] = self.total_miscues + 1
            result["miscue_type"] = miscue_type
            result["miscue_severity"] = "moderate"  # Default severity
            
            # Debug logging for accurate indexing
            print(f"❌ MISCUE: '{spoken_word}' != '{expected_word}' at position {self.current_position} (type: {miscue_type})")
            print(f"   Advancing anyway: {self.current_position} -> {self.current_position + 1}")
            
            # Update state - advance position even on miscue
            self.current_position += 1
            self.words_read += 1
            self.total_miscues += 1
        
        return result
    
    def _advanced_word_match(self, spoken_word: str, expected_word: str) -> bool:
        """
        IMPROVED: Advanced word matching with multiple similarity checks.
        """
        spoken_lower = spoken_word.lower().strip()
        expected_lower = expected_word.lower().strip()
        
        # Exact match
        if spoken_lower == expected_lower:
            return True
        
        # Fuzzy matching with language-specific thresholds
        similarity = difflib.SequenceMatcher(None, spoken_lower, expected_lower).ratio()
        
        # Language-specific thresholds with better accuracy
        if self.language == "tagalog":
            threshold = 0.60  # More lenient for Tagalog
        else:
            threshold = 0.65  # Improved English threshold
        
        if similarity >= threshold:
            return True
        
        # Check for common pronunciation variations
        variations = self._get_pronunciation_variations(expected_lower)
        if spoken_lower in variations:
            return True
        
        return False
    
    def _get_pronunciation_variations(self, word: str) -> set:
        """
        Get common pronunciation variations for a word.
        """
        variations = {word}  # Include original
        
        # Common English variations
        if self.language == "english":
            # th -> t/d variations
            if 'th' in word:
                variations.add(word.replace('th', 't'))
                variations.add(word.replace('th', 'd'))
            
            # r/l confusion (common in some accents)
            if 'r' in word:
                variations.add(word.replace('r', 'l'))
            if 'l' in word:
                variations.add(word.replace('l', 'r'))
        
        # Common Tagalog variations
        elif self.language == "tagalog":
            # p/b, t/d, k/g variations (common in Tagalog)
            variations.update([
                word.replace('p', 'b'), word.replace('b', 'p'),
                word.replace('t', 'd'), word.replace('d', 't'),
                word.replace('k', 'g'), word.replace('g', 'k'),
                word.replace('f', 'p'), word.replace('v', 'b')
            ])
        
        return variations
    
    def get_metrics(self, elapsed_time: Optional[float] = None) -> Dict:
        """Get metrics with minimal calculation."""
        if elapsed_time is None:
            elapsed_time = time.time() - self.start_time
        
        accuracy = 0
        if self.expected_words:
            accuracy = round((self.words_read / len(self.expected_words)) * 100, 2)
        
        return {
            "current_position": self.current_position,
            "words_read": self.words_read,
            "total_words": len(self.expected_words),
            "total_miscues": self.total_miscues,
            "accuracy": accuracy,
            "elapsed_time": round(elapsed_time, 2),
            "progress": f"{self.current_position}/{len(self.expected_words)}"
        }
