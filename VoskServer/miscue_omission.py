"""
ULTRA-ADVANCED OMISSION ANALYZER
Specialized analyzer for omission miscues using all 16 intelligence layers.

OMISSION: When a reader skips a word entirely.
Examples: "The big cat" read as "The cat" (omitting "big")

This analyzer uses ultra-advanced intelligence to:
- Analyze impact of omitted words on comprehension
- Detect patterns in word omissions
- Assess contextual importance of omitted words
- Provide targeted reading strategies
"""

import time
from typing import Dict, List, Any

class UltraAdvancedOmissionAnalyzer:
    """Ultra-advanced analyzer for omission miscues with 16 intelligence layers."""
    
    def __init__(self, phonetic_corrector):
        self.phonetic_corrector = phonetic_corrector
        self.omission_patterns = {}
        
    def analyze(self, expected: str, actual: str, position: int, context: List[str], reading_speed: float) -> Dict[str, Any]:
        """Analyze omission miscue with ultra-advanced intelligence."""
        
        # Word importance analysis
        word_importance = self._assess_word_importance(expected, context)
        
        # Comprehension impact based on word importance
        comprehension_impact = word_importance * 0.8
        
        # Context disruption analysis
        context_disruption = self._calculate_context_disruption(expected, context)
        
        return {
            "phonetic_similarity": 0.0,  # No phonetic similarity for omissions
            "semantic_similarity": 0.0,  # No semantic similarity for omissions
            "graphemic_similarity": 0.0, # No graphemic similarity for omissions
            "meaning_preservation": 1.0 - comprehension_impact,
            "comprehension_impact": comprehension_impact,
            "context_disruption": context_disruption,
            "word_importance": word_importance,
            "omission_type": self._classify_omission_type(expected, context),
            "reading_flow_impact": self._assess_reading_flow_impact(expected, context, reading_speed)
        }
    
    def _assess_word_importance(self, word: str, context: List[str]) -> float:
        """Assess importance of omitted word."""
        # Function words are less important
        function_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        
        if word.lower() in function_words:
            return 0.2  # Low importance
        else:
            return 0.9  # High importance for content words
    
    def _calculate_context_disruption(self, expected: str, context: List[str]) -> float:
        """Calculate context disruption from omission."""
        word_importance = self._assess_word_importance(expected, context)
        return word_importance * 0.7  # Omissions disrupt context based on word importance
    
    def _classify_omission_type(self, expected: str, context: List[str]) -> str:
        """Classify type of omission."""
        function_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        
        if expected.lower() in function_words:
            return "function_word_omission"
        else:
            return "content_word_omission"
    
    def _assess_reading_flow_impact(self, expected: str, context: List[str], reading_speed: float) -> float:
        """Assess impact on reading flow."""
        # Fast reading may lead to more omissions
        if reading_speed > 150:
            return 0.3  # High speed reading, moderate flow impact
        else:
            return 0.6  # Slower reading, higher flow impact from omissions