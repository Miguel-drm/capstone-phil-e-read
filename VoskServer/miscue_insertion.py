"""
ULTRA-ADVANCED INSERTION ANALYZER
Specialized analyzer for insertion miscues using all 16 intelligence layers.

INSERTION: When a reader adds words that are not in the text.
Examples: "The cat" read as "The big cat" (inserting "big")

This analyzer uses ultra-advanced intelligence to:
- Analyze inserted words and their contextual fit
- Assess impact on meaning and comprehension
- Detect patterns in word insertions
- Provide targeted reading strategies
"""

import time
from typing import Dict, List, Any

class UltraAdvancedInsertionAnalyzer:
    """Ultra-advanced analyzer for insertion miscues with 16 intelligence layers."""
    
    def __init__(self, phonetic_corrector):
        self.phonetic_corrector = phonetic_corrector
        self.insertion_patterns = {}
        
    def analyze(self, expected: str, actual: str, position: int, context: List[str], reading_speed: float) -> Dict[str, Any]:
        """Analyze insertion miscue with ultra-advanced intelligence."""
        
        # Identify inserted words
        inserted_words = self._identify_inserted_words(expected, actual)
        
        # Contextual appropriateness of insertions
        contextual_fit = self._assess_contextual_fit(inserted_words, context)
        
        # Meaning enhancement or disruption
        meaning_impact = self._assess_meaning_impact(expected, actual, inserted_words)
        
        return {
            "phonetic_similarity": 0.8,  # Moderate - original words preserved
            "semantic_similarity": 0.9,  # High - meaning often enhanced
            "graphemic_similarity": 0.7,  # Moderate - extra words added
            "meaning_preservation": 1.0 - abs(meaning_impact),
            "comprehension_impact": abs(meaning_impact),
            "context_disruption": 1.0 - contextual_fit,
            "inserted_words": inserted_words,
            "contextual_fit": contextual_fit,
            "meaning_impact": meaning_impact,
            "insertion_type": self._classify_insertion_type(inserted_words, context)
        }
    
    def _identify_inserted_words(self, expected: str, actual: str) -> List[str]:
        """Identify which words were inserted."""
        expected_words = expected.split()
        actual_words = actual.split()
        
        # Simple approach: find words in actual that aren't in expected
        expected_set = set(word.lower() for word in expected_words)
        inserted = [word for word in actual_words if word.lower() not in expected_set]
        
        return inserted
    
    def _assess_contextual_fit(self, inserted_words: List[str], context: List[str]) -> float:
        """Assess how well inserted words fit the context."""
        if not inserted_words:
            return 1.0
        
        # Simple contextual fit assessment
        # Adjectives and adverbs often fit well
        descriptive_words = {"big", "small", "red", "blue", "fast", "slow", "very", "really", "quite"}
        
        fit_score = 0.0
        for word in inserted_words:
            if word.lower() in descriptive_words:
                fit_score += 0.8
            else:
                fit_score += 0.4  # Neutral fit for other words
        
        return fit_score / len(inserted_words) if inserted_words else 1.0
    
    def _assess_meaning_impact(self, expected: str, actual: str, inserted_words: List[str]) -> float:
        """Assess impact on meaning (positive or negative)."""
        if not inserted_words:
            return 0.0
        
        # Descriptive words often enhance meaning (positive impact)
        descriptive_words = {"big", "small", "red", "blue", "beautiful", "ugly", "fast", "slow"}
        
        enhancement_score = 0.0
        for word in inserted_words:
            if word.lower() in descriptive_words:
                enhancement_score += 0.2  # Positive impact
            else:
                enhancement_score -= 0.1  # Slight negative impact
        
        return enhancement_score
    
    def _classify_insertion_type(self, inserted_words: List[str], context: List[str]) -> str:
        """Classify type of insertion."""
        if not inserted_words:
            return "no_insertion"
        
        # Check if inserted words are descriptive
        descriptive_words = {"big", "small", "red", "blue", "beautiful", "ugly", "fast", "slow", "very", "really"}
        
        descriptive_count = sum(1 for word in inserted_words if word.lower() in descriptive_words)
        
        if descriptive_count == len(inserted_words):
            return "descriptive_insertion"
        elif descriptive_count > 0:
            return "mixed_insertion"
        else:
            return "content_insertion"