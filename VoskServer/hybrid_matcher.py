"""
HYBRID word matcher - Intelligent switching between 1-by-1 and multi-word recognition.
Adapts to reading speed automatically for optimal user experience.
"""

import time
from typing import Dict, List, Optional, Tuple


class HybridMatcherSession:
    """
    Intelligent hybrid matcher that switches between:
    - 1-by-1 (word-by-word) for slow readers
    - Multi-word (phrase) for fast readers
    - Automatically adapts based on reading speed
    """
    
    def __init__(self, expected_words: List[str], language: str = "english"):
        self.expected_words = expected_words
        self.current_position = 0
        self.words_read = 0
        self.total_miscues = 0
        self.start_time = time.time()
        self.language = language
        
        # Speed tracking
        self.word_timestamps = []  # List of (position, timestamp) tuples
        self.reading_speed = 0.0  # words per second
        self.mode = "word_by_word"  # Current mode: "word_by_word" or "multi_word"
        
        # Multi-word buffer
        self.word_buffer = []  # Buffer for accumulating words
        self.buffer_start_position = 0
        
        # Speed thresholds
        self.SLOW_READER_THRESHOLD = 1.0  # < 1 word/sec = slow
        self.FAST_READER_THRESHOLD = 2.0  # > 2 words/sec = fast
        
    def calculate_reading_speed(self) -> float:
        """
        Calculate current reading speed in words per second.
        Uses last 5 words for accuracy.
        """
        if len(self.word_timestamps) < 2:
            return 0.0
        
        # Use last 5 words for calculation
        recent_words = self.word_timestamps[-5:]
        
        if len(recent_words) < 2:
            return 0.0
        
        time_span = recent_words[-1][1] - recent_words[0][1]
        if time_span == 0:
            return 0.0
        
        word_count = len(recent_words) - 1
        speed = word_count / time_span
        
        return speed
    
    def determine_mode(self) -> str:
        """
        Determine whether to use word-by-word or multi-word mode.
        Based on reading speed.
        """
        speed = self.calculate_reading_speed()
        
        if speed < self.SLOW_READER_THRESHOLD:
            return "word_by_word"
        elif speed > self.FAST_READER_THRESHOLD:
            return "multi_word"
        else:
            # Medium speed - use current mode
            return self.mode
    
    def process_word(self, spoken_word: str) -> Dict:
        """
        Process a single word with hybrid logic.
        Returns validation result with mode information.
        """
        # Record timestamp for speed calculation
        self.word_timestamps.append((self.current_position, time.time()))
        
        # Determine current mode
        self.mode = self.determine_mode()
        speed = self.calculate_reading_speed()
        
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
            "timestamp": time.time(),
            "mode": self.mode,  # Current mode
            "reading_speed": round(speed, 2),  # Words per second
            "buffer": []  # Words in buffer (for multi-word mode)
        }
        
        if self.mode == "word_by_word":
            # WORD-BY-WORD MODE: Validate immediately
            result = self._process_word_by_word(spoken_word, result)
        else:
            # MULTI-WORD MODE: Buffer words
            result = self._process_multi_word(spoken_word, result)
        
        return result
    
    def _process_word_by_word(self, spoken_word: str, result: Dict) -> Dict:
        """
        Process word in 1-by-1 mode.
        Validate immediately and advance on match.
        """
        # Check if at end
        if self.current_position >= len(self.expected_words):
            result["expected_word"] = ""
            return result
        
        # Get expected word
        expected_word = self.expected_words[self.current_position]
        result["expected_word"] = expected_word
        
        # Direct comparison (case-insensitive)
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
            # MISCUE ❌
            result["is_correct"] = False
            result["advance"] = False
            result["new_position"] = self.current_position
            result["total_miscues"] = self.total_miscues + 1
            
            # Update miscue count
            self.total_miscues += 1
        
        return result
    
    def _process_multi_word(self, spoken_word: str, result: Dict) -> Dict:
        """
        Process word in multi-word mode.
        Buffer words and validate when phrase is complete.
        """
        # Add word to buffer
        self.word_buffer.append(spoken_word)
        result["buffer"] = self.word_buffer.copy()
        
        # Try to match buffer against expected words
        buffer_text = " ".join(self.word_buffer).lower()
        
        # Check if buffer matches expected words
        expected_start = self.current_position
        expected_end = min(expected_start + len(self.word_buffer), len(self.expected_words))
        expected_text = " ".join(
            self.expected_words[expected_start:expected_end]
        ).lower()
        
        if buffer_text == expected_text:
            # BUFFER MATCHES ✅
            result["is_correct"] = True
            result["advance"] = True
            
            # Update position
            words_in_buffer = len(self.word_buffer)
            result["new_position"] = self.current_position + words_in_buffer
            result["words_read"] = self.words_read + words_in_buffer
            
            # Update state
            self.current_position += words_in_buffer
            self.words_read += words_in_buffer
            
            # Clear buffer
            self.word_buffer = []
            self.buffer_start_position = self.current_position
        else:
            # BUFFER DOESN'T MATCH YET
            result["is_correct"] = False
            result["advance"] = False
            result["new_position"] = self.current_position
            
            # Check if buffer is still valid (could be partial match)
            # If buffer is too long or clearly wrong, reset it
            if len(self.word_buffer) > 5:
                # Buffer too long, reset
                self.word_buffer = []
                self.buffer_start_position = self.current_position
        
        return result
    
    def get_metrics(self, elapsed_time: Optional[float] = None) -> Dict:
        """Get metrics with speed information."""
        if elapsed_time is None:
            elapsed_time = time.time() - self.start_time
        
        accuracy = 0
        if self.expected_words:
            accuracy = round((self.words_read / len(self.expected_words)) * 100, 2)
        
        speed = self.calculate_reading_speed()
        
        return {
            "current_position": self.current_position,
            "words_read": self.words_read,
            "total_words": len(self.expected_words),
            "total_miscues": self.total_miscues,
            "accuracy": accuracy,
            "elapsed_time": round(elapsed_time, 2),
            "progress": f"{self.current_position}/{len(self.expected_words)}",
            "reading_speed": round(speed, 2),  # Words per second
            "mode": self.mode,  # Current mode
            "buffer": self.word_buffer.copy()  # Current buffer
        }
