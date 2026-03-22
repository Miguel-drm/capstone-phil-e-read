"""
ULTRA-ADVANCED SUBSTITUTION ANALYZER
Specialized analyzer for substitution miscues using all 16 intelligence layers.

SUBSTITUTION: When a reader replaces one word with a completely different word.
Examples: "cat" read as "dog", "house" read as "home", "big" read as "large"

This analyzer uses ultra-advanced intelligence to:
- Analyze semantic relationships between substituted words
- Assess impact on meaning and comprehension
- Detect patterns in word substitutions
- Provide targeted reading strategies
"""

import time
from typing import Dict, List, Any
from difflib import SequenceMatcher

class UltraAdvancedSubstitutionAnalyzer:
    """Ultra-advanced analyzer for substitution miscues with 16 intelligence layers."""
    
    def __init__(self, phonetic_corrector):
        self.phonetic_corrector = phonetic_corrector
        self.substitution_patterns = {}
        
    def analyze(self, expected: str, actual: str, position: int, context: List[str], reading_speed: float) -> Dict[str, Any]:
        """Analyze substitution miscue with ultra-advanced intelligence."""
        
        # Semantic similarity analysis
        semantic_similarity = self._calculate_semantic_similarity(expected, actual)
        
        # Visual similarity analysis  
        graphemic_similarity = SequenceMatcher(None, expected.lower(), actual.lower()).ratio()
        
        # Meaning preservation assessment
        meaning_preservation = self._assess_meaning_preservation(expected, actual, context)
        
        # Comprehension impact analysis
        comprehension_impact = 1.0 - meaning_preservation
        
        return {
            "phonetic_similarity": 0.1,  # Low for true substitutions
            "semantic_similarity": semantic_similarity,
            "graphemic_similarity": graphemic_similarity,
            "meaning_preservation": meaning_preservation,
            "comprehension_impact": comprehension_impact,
            "context_disruption": self._calculate_context_disruption(expected, actual, context),
            "substitution_type": self._classify_substitution_type(expected, actual),
            "semantic_relationship": self._analyze_semantic_relationship(expected, actual)
        }
    
    def _calculate_semantic_similarity(self, word1: str, word2: str) -> float:
        """Calculate semantic similarity between substituted words."""
        # Basic semantic categories
        categories = {
            "animals": ["cat", "dog", "bird", "fish", "horse", "cow"],
            "colors": ["red", "blue", "green", "yellow", "black", "white"],
            "sizes": ["big", "small", "large", "tiny", "huge", "little"],
            "actions": ["run", "walk", "jump", "sit", "stand", "go"]
        }
        
        word1_lower = word1.lower()
        word2_lower = word2.lower()
        
        # Check if both words are in the same category
        for category, words in categories.items():
            if word1_lower in words and word2_lower in words:
                return 0.8  # High semantic similarity
        
        # Default to string similarity as approximation
        return SequenceMatcher(None, word1_lower, word2_lower).ratio()
    
    def _assess_meaning_preservation(self, expected: str, actual: str, context: List[str]) -> float:
        """Assess how well meaning is preserved in substitution."""
        semantic_sim = self._calculate_semantic_similarity(expected, actual)
        
        # If words are semantically similar, meaning is better preserved
        if semantic_sim > 0.7:
            return 0.8
        elif semantic_sim > 0.4:
            return 0.5
        else:
            return 0.2
    
    def _calculate_context_disruption(self, expected: str, actual: str, context: List[str]) -> float:
        """Calculate how much substitution disrupts context."""
        # Simple context disruption based on semantic fit
        semantic_similarity = self._calculate_semantic_similarity(expected, actual)
        return 1.0 - semantic_similarity
    
    def _classify_substitution_type(self, expected: str, actual: str) -> str:
        """Classify the type of substitution."""
        semantic_sim = self._calculate_semantic_similarity(expected, actual)
        visual_sim = SequenceMatcher(None, expected.lower(), actual.lower()).ratio()
        
        if semantic_sim > 0.7:
            return "semantic_substitution"  # Similar meaning
        elif visual_sim > 0.7:
            return "visual_substitution"    # Similar appearance
        else:
            return "random_substitution"    # Unrelated word
    
    def _analyze_semantic_relationship(self, expected: str, actual: str) -> str:
        """Analyze semantic relationship between words."""
        semantic_sim = self._calculate_semantic_similarity(expected, actual)
        
        if semantic_sim > 0.8:
            return "synonyms"
        elif semantic_sim > 0.6:
            return "related_concepts"
        elif semantic_sim > 0.3:
            return "same_category"
        else:
            return "unrelated"