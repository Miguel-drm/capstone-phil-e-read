#!/usr/bin/env python3
"""
Smart Buffer Matcher - Advanced algorithm to handle Vosk's word reordering
Buffers incoming words and intelligently matches them to expected sequence
"""

from typing import List, Dict, Optional, Tuple
from collections import deque
import time

# Import phonetic validator and substitution verifier
try:
    from phonetic_similarity_validator import validate_substitution
    PHONETIC_VALIDATOR_AVAILABLE = True
except ImportError:
    PHONETIC_VALIDATOR_AVAILABLE = False

try:
    from substitution_verifier import SubstitutionVerifier
    SUBSTITUTION_VERIFIER_AVAILABLE = True
except ImportError:
    SUBSTITUTION_VERIFIER_AVAILABLE = False


class SmartBufferMatcher:
    """
    Buffers incoming words from Vosk and intelligently matches them to expected words.
    Handles Vosk's severe word reordering by looking for best matches in a buffer.
    """
    
    def __init__(self, expected_words: List[str], buffer_size: int = 80):
        """
        Initialize the smart buffer matcher.
        
        Args:
            expected_words: List of expected words in order
            buffer_size: Number of words to buffer before matching (default: 8, increased from 5)
        """
        self.expected_words = expected_words
        self.buffer_size = buffer_size
        self.word_buffer = deque(maxlen=buffer_size)  # Circular buffer
        self.current_position = 0
        self.total_miscues = 0
        self.words_read = 0
        
        # Track which words we've seen (for duplicate detection)
        self.seen_words = set()
        
        # Track timing for each word
        self.word_timestamps = {}
        
        # Initialize substitution verifier
        if SUBSTITUTION_VERIFIER_AVAILABLE:
            self.substitution_verifier = SubstitutionVerifier(expected_words, verification_window=3)
            print("✓ Substitution verifier enabled (suspect and verify)")
        else:
            self.substitution_verifier = None
    
    def add_word(self, word: str) -> Optional[Dict]:
        """
        Add a word to the buffer and try to match it.
        
        Args:
            word: Word received from Vosk
            
        Returns:
            Match result if a match was made, None if buffering
        """
        word_lower = word.lower().strip()
        timestamp = time.time()
        
        # DUPLICATE FILTER: Skip rapid duplicates (Vosk reordering issue)
        # Only filter if same word arrives within 0.5 seconds
        if word_lower in self.word_timestamps:
            time_diff = timestamp - self.word_timestamps[word_lower]
            if time_diff < 0.5:  # Very short time = likely duplicate
                print(f"   🔄 Skipping rapid duplicate: '{word}' (arrived {time_diff:.2f}s after previous)")
                return {
                    "match_type": "buffering",
                    "advance": False,
                    "new_position": self.current_position,
                    "miscue_count": 0,
                    "details": f"Buffering words for intelligent matching"
                }
        
        # GARBAGE WORD FILTER: DISABLED - was blocking valid words
        # Some words might be pronunciation variants that we want to keep
        # if not self._word_exists_in_story(word_lower):
        #     print(f"   🗑️ Skipping garbage word: '{word}' (not in story vocabulary)")
        #     return None
        
        # Add to buffer
        self.word_buffer.append((word_lower, timestamp))
        self.word_timestamps[word_lower] = timestamp
        
        expected_word = self.expected_words[self.current_position] if self.current_position < len(self.expected_words) else "END"
        print(f"   📦 Buffer: {[w for w, _ in self.word_buffer]} (size: {len(self.word_buffer)})")
        print(f"   🎯 Looking for: '{expected_word}' at position {self.current_position}")
        
        # Try to match from buffer
        return self._try_match_from_buffer()
    
    def _try_match_from_buffer(self) -> Optional[Dict]:
        """
        Try to find the best match for the current expected word in the buffer.
        Uses OPTIMISTIC MATCHING for speed: match immediately if found, 
        only wait if no match after reasonable time.
        
        Returns:
            Match result if found, None if no match yet
        """
        if self.current_position >= len(self.expected_words):
            return {
                "match_type": "end_of_story",
                "advance": False,
                "new_position": self.current_position,
                "miscue_count": 0,
                "details": "Reached end of story"
            }
        
        expected_word = self.expected_words[self.current_position].lower().strip()
        
        # OPTIMISTIC MATCHING: Check if the NEWEST word matches (most common case)
        # This gives instant feedback when reading in order
        if len(self.word_buffer) > 0:
            newest_word, newest_timestamp = self.word_buffer[-1]
            if self._words_match(newest_word, expected_word):
                print(f"   ⚡ INSTANT match: '{newest_word}' matches expected '{expected_word}' (newest word)")
                
                # Remove matched word from buffer
                self.word_buffer.remove((newest_word, newest_timestamp))
                
                # Advance position
                self.current_position += 1
                self.words_read += 1
                
                return {
                    "match_type": "correct",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 0,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "details": f"Correct: '{newest_word}' matches '{expected_word}'"
                }
        
        # FALLBACK: Look for match anywhere in buffer (handles reordering)
        for i, (buffered_word, timestamp) in enumerate(self.word_buffer):
            if self._words_match(buffered_word, expected_word):
                # Found a match! Remove it from buffer and advance
                print(f"   ✅ Match found: '{buffered_word}' matches expected '{expected_word}' (position {i} in buffer)")
                
                # Remove matched word from buffer
                self.word_buffer.remove((buffered_word, timestamp))
                
                # Advance position
                self.current_position += 1
                self.words_read += 1
                
                return {
                    "match_type": "correct",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 0,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "details": f"Correct: '{buffered_word}' matches '{expected_word}'"
                }
        
        # No match found yet - use SMART TIMEOUT instead of fixed buffer size
        # Wait for 10 words OR 3 seconds (whichever comes first)
        SMART_WAIT_WORDS = 10  # Much faster than 80!
        SMART_WAIT_TIME = 3.0  # 3 seconds max wait
        
        if len(self.word_buffer) >= SMART_WAIT_WORDS:
            # Check if we've waited long enough (time-based)
            oldest_word, oldest_timestamp = self.word_buffer[0]
            time_waited = time.time() - oldest_timestamp
            
            if time_waited >= SMART_WAIT_TIME or len(self.word_buffer) >= self.buffer_size:
                print(f"   ⚠️ No match for '{expected_word}' after {len(self.word_buffer)} words / {time_waited:.1f}s")
                print(f"   📦 Buffer: {[w for w, _ in list(self.word_buffer)[:10]]}...")
                print(f"   ⏭️ Marking '{expected_word}' as OMISSION")
            
            # DISABLED LOOKAHEAD: Just mark current word as omission and continue
            # The larger buffer (80 words) should give enough time for reordered words to arrive
            
            # Remove oldest word from buffer to make room
            self.word_buffer.popleft()
            
            # Mark current expected word as omission
            self.current_position += 1
            self.total_miscues += 1
            
            return {
                "match_type": "omission",
                "advance": True,
                "new_position": self.current_position,
                "miscue_count": 1,
                "words_read": self.words_read,
                "total_miscues": self.total_miscues,
                "details": f"Omission: '{expected_word}' not found after waiting {self.buffer_size} words"
            }
            
            # OLD CODE BELOW (DISABLED)
            self.word_buffer.popleft()
            
            # MISCUE PRIORITIZATION: Check other miscue types before substitution
            # Priority order (Phil-IRI): Mispronunciation > Reversal > Substitution
            
            # 1. Check for MISPRONUNCIATION (phonetically similar)
            similarity = self._calculate_similarity(oldest_word, expected_word)
            if similarity >= 0.60:  # 60% or more similar
                print(f"   🔍 MISPRONUNCIATION detected: '{oldest_word}' vs '{expected_word}' ({int(similarity*100)}% similar)")
                
                self.current_position += 1
                self.words_read += 1
                self.total_miscues += 1
                
                return {
                    "match_type": "mispronunciation",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "similarity": similarity,
                    "details": f"Mispronunciation: '{oldest_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)"
                }
            
            # 2. Check for REVERSAL (letters reversed)
            if self._is_reversal(oldest_word, expected_word):
                print(f"   🔄 REVERSAL detected: '{oldest_word}' is reverse of '{expected_word}'")
                
                self.current_position += 1
                self.words_read += 1
                self.total_miscues += 1
                
                return {
                    "match_type": "reversal",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "details": f"Reversal: '{oldest_word}' is reverse of '{expected_word}'"
                }
            
            # 3. LAST RESORT: SUBSTITUTION (completely different word)
            # Only mark as substitution if similarity is very low (<40%)
            if similarity < 0.40:
                print(f"   ❌ SUBSTITUTION: '{oldest_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)")
                
                self.current_position += 1
                self.words_read += 1
                self.total_miscues += 1
                
                return {
                    "match_type": "substitution",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "similarity": similarity,
                    "details": f"Substitution: '{oldest_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)"
                }
            else:
                # Similarity is 40-60% - treat as mispronunciation instead
                print(f"   🔍 MISPRONUNCIATION (borderline): '{oldest_word}' vs '{expected_word}' ({int(similarity*100)}% similar)")
                
                self.current_position += 1
                self.words_read += 1
                self.total_miscues += 1
                
                return {
                    "match_type": "mispronunciation",
                    "advance": True,
                    "new_position": self.current_position,
                    "miscue_count": 1,
                    "words_read": self.words_read,
                    "total_miscues": self.total_miscues,
                    "similarity": similarity,
                    "details": f"Mispronunciation: '{oldest_word}' instead of '{expected_word}' ({int(similarity*100)}% similar)"
                }
        
        # Buffer not full yet - keep buffering
        return {
            "match_type": "buffering",
            "advance": False,
            "new_position": self.current_position,
            "miscue_count": 0,
            "words_read": self.words_read,
            "total_miscues": self.total_miscues,
            "details": f"Buffering words for intelligent matching"
        }
    
    def _words_match(self, word1: str, word2: str) -> bool:
        """
        Check if two words match (including pronunciation variants).
        Uses aggressive matching for short words to handle Vosk's poor recognition.
        
        Args:
            word1: First word
            word2: Second word
            
        Returns:
            True if words match
        """
        # Exact match
        if word1 == word2:
            return True
        
        # Expanded pronunciation variants for better matching
        variants = {
            'a': ['uh', 'ah', 'ay', 'eh', 'ey', 'ae'],
            'the': ['da', 'de', 'thuh', 'thee', 'duh', 'thee', 'thuh'],
            'sad': ['said', 'sadd'],
            'is': ['iz', 'iss', 'iss', 'izz'],
            'it': ['itt', 'et', 'itt'],
            'oh': ['o', 'ooh', 'ohh', 'ooh'],
            'no': ['noh', 'know', 'nope'],
            'on': ['onn', 'ohn'],
            'of': ['off', 'ov'],
            'off': ['of', 'ov'],
            'bed': ['bedd', 'bet'],
            'can': ['cann', 'ken'],
            'has': ['haz', 'hass'],
            'cat': ['kat', 'catt'],
        }
        
        # Check if word1 is a variant of word2
        if word2 in variants and word1 in variants[word2]:
            return True
        
        # Check if word2 is a variant of word1
        if word1 in variants and word2 in variants[word1]:
            return True
        
        # AGGRESSIVE SHORT WORD MATCHING (2-3 letters)
        # Short words are often misrecognized by Vosk, so be more lenient
        if len(word1) <= 3 or len(word2) <= 3:
            # Check if they start with the same letter and are similar length
            if word1[0] == word2[0] and abs(len(word1) - len(word2)) <= 1:
                similarity = self._calculate_similarity(word1, word2)
                if similarity >= 0.70:  # Lower threshold for short words
                    return True
        
        # Check very high similarity (95%+) for longer words
        similarity = self._calculate_similarity(word1, word2)
        if similarity >= 0.95:
            return True
        
        return False
    
    def _calculate_similarity(self, word1: str, word2: str) -> float:
        """
        Calculate similarity between two words (0.0 to 1.0).
        
        Args:
            word1: First word
            word2: Second word
            
        Returns:
            Similarity score from 0.0 (completely different) to 1.0 (identical)
        """
        from difflib import SequenceMatcher
        
        if not word1 or not word2:
            return 0.0
        
        return SequenceMatcher(None, word1.lower(), word2.lower()).ratio()
    
    def _is_reversal(self, word1: str, word2: str) -> bool:
        """
        Check if word1 is the reverse of word2.
        
        Examples:
        - "was" → "saw"
        - "on" → "no"
        - "pot" → "top"
        
        Args:
            word1: First word
            word2: Second word
            
        Returns:
            True if word1 is the reverse of word2
        """
        word1_lower = word1.lower().strip()
        word2_lower = word2.lower().strip()
        
        # Must be at least 2 characters to be a meaningful reversal
        if len(word1_lower) >= 2 and len(word2_lower) >= 2:
            return word1_lower == word2_lower[::-1]
        
        return False
    
    def _word_exists_in_story(self, word: str) -> bool:
        """
        Check if a word exists anywhere in the story vocabulary.
        This filters out garbage words that Vosk hallucinates.
        
        Args:
            word: Word to check
            
        Returns:
            True if word exists in story, False if it's garbage
        """
        word_lower = word.lower().strip()
        
        # Check if word matches any expected word (including pronunciation variants)
        for expected_word in self.expected_words:
            if self._words_match(word_lower, expected_word.lower().strip()):
                return True
        
        return False
    
    def flush_buffer(self) -> List[Dict]:
        """
        Flush remaining words in buffer at end of session.
        Marks remaining expected words as omissions.
        
        Returns:
            List of match results for remaining words
        """
        results = []
        
        # Mark all remaining expected words as omissions
        while self.current_position < len(self.expected_words):
            expected_word = self.expected_words[self.current_position]
            
            self.current_position += 1
            self.total_miscues += 1
            
            results.append({
                "match_type": "omission",
                "advance": True,
                "new_position": self.current_position,
                "miscue_count": 1,
                "words_read": self.words_read,
                "total_miscues": self.total_miscues,
                "details": f"Omission: '{expected_word}' not read"
            })
        
        return results
    
    def get_metrics(self, elapsed_time: float) -> Dict:
        """
        Calculate reading metrics.
        
        Args:
            elapsed_time: Elapsed time in seconds
            
        Returns:
            Dictionary with metrics
        """
        total_words = len(self.expected_words)
        
        # Calculate WPM
        wpm = 0
        if elapsed_time > 0:
            wpm = int((self.words_read / elapsed_time) * 60)
        
        # Calculate accuracy
        accuracy = 0.0
        if self.words_read > 0:
            correct_words = self.words_read - self.total_miscues
            accuracy = (correct_words / self.words_read) * 100
        
        # Calculate oral reading score
        oral_reading_score = 0.0
        if total_words > 0:
            correct_words = self.words_read - self.total_miscues
            oral_reading_score = (correct_words / total_words) * 100
            oral_reading_score = max(0.0, min(100.0, oral_reading_score))
        
        return {
            "wpm": wpm,
            "accuracy": round(accuracy, 1),
            "oral_reading_score": round(oral_reading_score, 1),
            "words_read": self.words_read,
            "total_words": total_words,
            "total_miscues": self.total_miscues,
            "elapsed_time": round(elapsed_time, 1),
            "progress_percent": round((self.current_position / total_words) * 100, 1) if total_words > 0 else 0
        }
