"""
EXTREME SPEED word matcher - minimal overhead, maximum performance.
100% REAL-TIME word-by-word recognition with instant validation.
"""

import time
from typing import Dict, List, Optional


def check_pronunciation_match(spoken_word: str, expected_word: str, language: str = "english") -> bool:
    """
    EXTREME SPEED: Direct string comparison only.
    No normalization, no processing, just pure comparison.
    """
    # Direct comparison - fastest possible
    return spoken_word.lower() == expected_word.lower()


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
        
        # DIRECT COMPARISON: Case-insensitive exact match
        is_match = spoken_word.lower() == expected_word.lower()
        
        if is_match:
            # CORRECT WORD ✅
            result["is_correct"] = True
            result["advance"] = True
            result["new_position"] = self.current_position + 1
            result["words_read"] = self.words_read + 1
            
            # Update state
            self.current_position += 1
            self.words_read += 1
        else:
            # MISCUE (ERROR) ❌
            result["is_correct"] = False
            result["advance"] = False
            result["new_position"] = self.current_position
            result["total_miscues"] = self.total_miscues + 1
            
            # Update miscue count
            self.total_miscues += 1
        
        return result
    
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
