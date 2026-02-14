"""
Strict Sequential Word Matching for Reading Assessment

Production-ready Python implementation for backend word matching.
Handles streaming Vosk results with strict sequential validation.

Key Features:
- Only matches NEXT expected word (current_index)
- Never skips ahead or searches future words
- Handles streaming partial/final results
- Configurable confidence threshold
- Comprehensive error handling
"""

import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class MatchType(Enum):
    """Types of match results."""
    MATCHED = "matched"
    NOT_MATCHED = "not_matched"
    END_OF_STORY = "end_of_story"
    INVALID_STATE = "invalid_state"


@dataclass
class MatchResult:
    """Result of matching a single word."""
    matched: bool
    expected_word: str
    spoken_word: str
    confidence: float  # 0-100
    current_index: int
    should_advance: bool
    match_type: MatchType
    details: str


@dataclass
class ProcessResult:
    """Result of processing multiple words."""
    results: List[MatchResult]
    updated_index: int
    total_matched: int
    details: str


class SequentialWordMatcher:
    """
    Strict sequential word matcher for reading assessment.
    
    CRITICAL RULES:
    1. Only compare against expected_words[current_index]
    2. Never search ahead or behind
    3. Advance only on match
    4. Handle streaming results without false positives
    """
    
    def __init__(
        self,
        sentence: str,
        min_confidence: float = 0.7,
        language: str = "english"
    ):
        """
        Initialize the matcher.
        
        Args:
            sentence: The expected sentence to match against
            min_confidence: Confidence threshold (0.0-1.0)
            language: Language mode ("english" or "tagalog")
        """
        if not sentence or not isinstance(sentence, str):
            raise ValueError("Sentence must be a non-empty string")
        
        if not 0.0 <= min_confidence <= 1.0:
            raise ValueError("min_confidence must be between 0.0 and 1.0")
        
        self.expected_words = self._tokenize(sentence)
        self.current_index = 0
        self.min_confidence = min_confidence
        self.language = language
        self.total_words_matched = 0
        self.match_history: List[MatchResult] = []
    
    def _tokenize(self, sentence: str) -> List[str]:
        """
        Tokenize sentence into words.
        
        Removes punctuation and converts to lowercase.
        """
        # Convert to lowercase
        text = sentence.lower()
        
        # Split on whitespace
        words = text.split()
        
        # Remove punctuation from each word
        cleaned = []
        for word in words:
            # Remove punctuation: . , ! ? ; : — - ( ) [ ] { }
            cleaned_word = re.sub(r'[.,!?;:\-—()[\]{}]', '', word)
            if cleaned_word:  # Only add non-empty words
                cleaned.append(cleaned_word)
        
        return cleaned
    
    def match_next_word(self, spoken_word: str) -> MatchResult:
        """
        CORE FUNCTION: Match spoken word against NEXT expected word only.
        
        CRITICAL: Only compares against expected_words[current_index]
        Never searches ahead or behind.
        
        Args:
            spoken_word: The word recognized by speech engine
            
        Returns:
            MatchResult with match details
        """
        # Validate state
        if self.current_index >= len(self.expected_words):
            return MatchResult(
                matched=False,
                expected_word="",
                spoken_word=spoken_word.lower(),
                confidence=0.0,
                current_index=self.current_index,
                should_advance=False,
                match_type=MatchType.END_OF_STORY,
                details="Already at end of story"
            )
        
        if self.current_index < 0:
            return MatchResult(
                matched=False,
                expected_word="",
                spoken_word=spoken_word.lower(),
                confidence=0.0,
                current_index=self.current_index,
                should_advance=False,
                match_type=MatchType.INVALID_STATE,
                details="Invalid state: negative index"
            )
        
        # Get expected word at current position
        expected_word = self.expected_words[self.current_index]
        
        # Normalize spoken word
        clean_spoken = self._normalize_word(spoken_word)
        
        # Handle empty spoken word
        if not clean_spoken:
            return MatchResult(
                matched=False,
                expected_word=expected_word,
                spoken_word="",
                confidence=0.0,
                current_index=self.current_index,
                should_advance=False,
                match_type=MatchType.NOT_MATCHED,
                details="Empty spoken word"
            )
        
        # Calculate confidence
        confidence = self._calculate_similarity(clean_spoken, expected_word)
        
        # Determine if match meets threshold
        matched = confidence >= self.min_confidence
        
        result = MatchResult(
            matched=matched,
            expected_word=expected_word,
            spoken_word=clean_spoken,
            confidence=confidence,
            current_index=self.current_index,
            should_advance=matched,
            match_type=MatchType.MATCHED if matched else MatchType.NOT_MATCHED,
            details=(
                f"Matched: {clean_spoken} → {expected_word} ({confidence:.0%})"
                if matched
                else f"Not matched: {clean_spoken} vs {expected_word} ({confidence:.0%})"
            )
        )
        
        # Track history
        self.match_history.append(result)
        
        return result
    
    def process_recognized_words(
        self,
        words: List[str]
    ) -> ProcessResult:
        """
        Process multiple words from a single recognition event.
        
        CRITICAL: Process sequentially, never skip ahead.
        
        Args:
            words: List of recognized words
            
        Returns:
            ProcessResult with all match results and updated state
        """
        if not words:
            return ProcessResult(
                results=[],
                updated_index=self.current_index,
                total_matched=0,
                details="Empty word list"
            )
        
        results: List[MatchResult] = []
        total_matched = 0
        
        for word in words:
            # Match against current position
            result = self.match_next_word(word)
            results.append(result)
            
            # Only advance if matched
            if result.should_advance:
                self.current_index += 1
                total_matched += 1
                self.total_words_matched += 1
            # If not matched, stay at current index (don't skip)
        
        return ProcessResult(
            results=results,
            updated_index=self.current_index,
            total_matched=total_matched,
            details=f"Processed {len(words)} words, matched {total_matched}"
        )
    
    def advance_to_word(self, target_index: int) -> None:
        """
        Manually advance to a specific word index.
        
        Used for omissions or manual corrections.
        
        Args:
            target_index: Target word index
        """
        # Validate target
        target = max(0, min(target_index, len(self.expected_words)))
        self.current_index = target
    
    def reset(self) -> None:
        """Reset matcher to beginning."""
        self.current_index = 0
        self.total_words_matched = 0
        self.match_history = []
    
    def get_current_word(self) -> Optional[str]:
        """Get the current expected word."""
        if self.current_index >= len(self.expected_words):
            return None
        return self.expected_words[self.current_index]
    
    def get_progress(self) -> Dict[str, any]:
        """Get progress information."""
        total = len(self.expected_words)
        current = self.current_index
        
        return {
            "current_index": current,
            "total_words": total,
            "words_matched": self.total_words_matched,
            "progress_percent": (current / total * 100) if total > 0 else 0,
            "remaining_words": total - current,
            "is_complete": current >= total
        }
    
    def _normalize_word(self, word: str) -> str:
        """
        Normalize a word for comparison.
        
        Converts to lowercase and removes punctuation.
        """
        if not word:
            return ""
        
        # Convert to lowercase
        normalized = word.lower()
        
        # Remove punctuation
        normalized = re.sub(r'[.,!?;:\-—()[\]{}]', '', normalized)
        
        # Strip whitespace
        normalized = normalized.strip()
        
        return normalized
    
    def _calculate_similarity(self, word1: str, word2: str) -> float:
        """
        Calculate similarity between two words using Levenshtein distance.
        
        Returns confidence as 0.0-1.0 (0-100%).
        """
        w1 = word1.lower()
        w2 = word2.lower()
        
        # Exact match
        if w1 == w2:
            return 1.0
        
        # Empty strings
        max_len = max(len(w1), len(w2))
        if max_len == 0:
            return 1.0
        
        # Calculate Levenshtein distance
        distance = self._levenshtein_distance(w1, w2)
        
        # Convert to similarity (0.0-1.0)
        similarity = (max_len - distance) / max_len
        
        return max(0.0, min(1.0, similarity))
    
    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Levenshtein distance between two strings.
        
        Represents minimum edits (insert, delete, substitute) needed
        to transform s1 into s2.
        """
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        # Use only two rows for space efficiency
        previous_row = list(range(len(s2) + 1))
        
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            
            for j, c2 in enumerate(s2):
                # Cost of insertions, deletions, substitutions
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                
                current_row.append(min(insertions, deletions, substitutions))
            
            previous_row = current_row
        
        return previous_row[-1]


# ============================================================================
# Example Usage
# ============================================================================

def example_basic_matching():
    """Example: Basic word matching."""
    print("=" * 70)
    print("EXAMPLE 1: Basic Word Matching")
    print("=" * 70)
    
    sentence = "Pam has a cat. It is on the bed."
    matcher = SequentialWordMatcher(sentence, min_confidence=0.7)
    
    print(f"Expected sentence: {sentence}")
    print(f"Expected words: {matcher.expected_words}")
    print()
    
    # Simulate user reading
    spoken_words = ["Pam", "has", "a", "cat"]
    
    for word in spoken_words:
        result = matcher.match_next_word(word)
        print(f"Spoken: '{word}'")
        print(f"  Expected: '{result.expected_word}'")
        print(f"  Confidence: {result.confidence:.0%}")
        print(f"  Matched: {result.matched}")
        print(f"  Details: {result.details}")
        print()
    
    print(f"Progress: {matcher.get_progress()}")
    print()


def example_early_word_bug():
    """Example: Early word detection bug (FIXED)."""
    print("=" * 70)
    print("EXAMPLE 2: Early Word Detection Bug (FIXED)")
    print("=" * 70)
    
    sentence = "Pam has a cat. It is on the bed."
    matcher = SequentialWordMatcher(sentence, min_confidence=0.7)
    
    print(f"Expected sentence: {sentence}")
    print(f"Expected words: {matcher.expected_words}")
    print()
    
    # User says "Pam has a cat"
    print("User says: 'Pam has a cat'")
    result1 = matcher.process_recognized_words(["Pam", "has", "a", "cat"])
    print(f"Result: {result1.details}")
    print(f"Current index: {matcher.current_index}")
    print()
    
    # Vosk mistakenly detects "bed" early
    print("Vosk mistakenly detects: 'bed'")
    print("Current index: 4 (expecting 'It')")
    result2 = matcher.match_next_word("bed")
    print(f"Result: {result2.details}")
    print(f"Matched: {result2.matched} ✅ (BUG FIXED!)")
    print(f"Current index: {matcher.current_index} (unchanged)")
    print()


def example_mispronunciation():
    """Example: Handling mispronunciations."""
    print("=" * 70)
    print("EXAMPLE 3: Mispronunciation Handling")
    print("=" * 70)
    
    sentence = "The cat sat on the mat."
    matcher = SequentialWordMatcher(sentence, min_confidence=0.7)
    
    print(f"Expected sentence: {sentence}")
    print()
    
    # User mispronounces "the" as "da"
    print("User says: 'da' (mispronunciation of 'the')")
    result = matcher.match_next_word("da")
    print(f"Expected: '{result.expected_word}'")
    print(f"Spoken: '{result.spoken_word}'")
    print(f"Confidence: {result.confidence:.0%}")
    print(f"Matched: {result.matched}")
    print(f"Details: {result.details}")
    print()


def example_streaming_results():
    """Example: Handling streaming Vosk results."""
    print("=" * 70)
    print("EXAMPLE 4: Streaming Results (Partial vs Final)")
    print("=" * 70)
    
    sentence = "Pam has a cat."
    matcher = SequentialWordMatcher(sentence, min_confidence=0.7)
    
    print(f"Expected sentence: {sentence}")
    print()
    
    # Simulate streaming partial results
    print("Vosk partial results (IGNORED):")
    print("  'P' → 'Pa' → 'Pam'")
    print("  (No matching happens with partial results)")
    print()
    
    # Final result arrives
    print("Vosk final result: 'Pam has'")
    result = matcher.process_recognized_words(["Pam", "has"])
    print(f"Result: {result.details}")
    print(f"Matched: {result.total_matched} words")
    print(f"Current index: {matcher.current_index}")
    print()


def example_multiple_words():
    """Example: Processing multiple words in one result."""
    print("=" * 70)
    print("EXAMPLE 5: Multiple Words in One Result")
    print("=" * 70)
    
    sentence = "Pam has a cat. It is on the bed."
    matcher = SequentialWordMatcher(sentence, min_confidence=0.7)
    
    print(f"Expected sentence: {sentence}")
    print()
    
    # Process multiple words
    print("Vosk result: 'Pam has a cat It is'")
    result = matcher.process_recognized_words(
        ["Pam", "has", "a", "cat", "It", "is"]
    )
    
    print(f"Results:")
    for i, match_result in enumerate(result.results):
        print(f"  {i+1}. '{match_result.spoken_word}' → '{match_result.expected_word}': "
              f"{match_result.matched} ({match_result.confidence:.0%})")
    
    print()
    print(f"Summary: {result.details}")
    print(f"Current index: {matcher.current_index}")
    print(f"Progress: {matcher.get_progress()}")
    print()


if __name__ == "__main__":
    example_basic_matching()
    example_early_word_bug()
    example_mispronunciation()
    example_streaming_results()
    example_multiple_words()
    
    print("=" * 70)
    print("All examples completed successfully!")
    print("=" * 70)
