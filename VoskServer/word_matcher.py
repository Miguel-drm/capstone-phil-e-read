"""
EXTREME SPEED word matcher - minimal overhead, maximum performance.
"""

import time
from typing import Dict, List, Optional


def check_pronunciation_match(spoken_word: str, expected_word: str, language: str = "english") -> bool:
    """
    EXTREME SPEED: Direct string comparison only.
    No normalization, no processing, just pure comparison.
    """
    # Direct comparison - fastest possible
    return spoken_word == expected_word


class WordMatcherSession:
    """
    EXTREME SPEED word matcher - minimal state tracking.
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        self.expected_words = expected_words
        self.current_position = 0
        self.words_read = 0
        self.start_time = time.time()
        
    def process_word(self, spoken_word: str) -> Dict:
        """
        EXTREME SPEED: Minimal processing, instant response.
        """
        result = {
            "match_type": "no_match",
            "accepted_word": None,
            "advance": False,
            "new_position": self.current_position,
            "words_read": self.words_read,
            "total_miscues": 0,
            "miscue_count": 0,
            "details": ""
        }
        
        # Check if at end
        if self.current_position >= len(self.expected_words):
            return result
        
        # Get expected word
        expected_word = self.expected_words[self.current_position]
        
        # Direct comparison
        if spoken_word == expected_word:
            result["match_type"] = "correct"
            result["accepted_word"] = spoken_word
            result["advance"] = True
            result["new_position"] = self.current_position + 1
            result["words_read"] = self.words_read + 1
            
            # Update state
            self.current_position += 1
            self.words_read += 1
        
        return result
    
    def get_metrics(self, elapsed_time: Optional[float] = None) -> Dict:
        """Get metrics with minimal calculation."""
        if elapsed_time is None:
            elapsed_time = time.time() - self.start_time
        
        return {
            "current_position": self.current_position,
            "words_read": self.words_read,
            "total_words": len(self.expected_words),
            "accuracy": round((self.words_read / len(self.expected_words)) * 100, 2) if self.expected_words else 0,
            "elapsed_time": round(elapsed_time, 2),
            "progress": f"{self.current_position}/{len(self.expected_words)}"
        }
