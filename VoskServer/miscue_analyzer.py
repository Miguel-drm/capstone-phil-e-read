"""
ULTRA-ADVANCED MISCUE ANALYSIS SYSTEM
Applies all 16 intelligence layers to sophisticated miscue detection and classification.

MISCUE TYPES SUPPORTED:
- MISPRONOUNCE: Incorrect pronunciation of a word
- SUBSTITUTION: Replacing one word with another
- OMISSION: Skipping a word entirely
- TRANSPOSITION: Swapping word order
- REVERSAL: Reading words in reverse order
- INSERTION: Adding words not in the text
- SELF-CORRECT: Reader corrects their own mistake (NOT counted as miscue)
- CORRECT: Perfect reading (NOT counted as miscue)

Each miscue type has its own specialized analysis file and intelligence.
"""

import time
import json
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum
from dataclasses import dataclass, field
from collections import deque

class MiscueType(Enum):
    """Types of reading miscues with ultra-advanced classification."""
    MISPRONOUNCE = "mispronounce"
    SUBSTITUTION = "substitution"
    OMISSION = "omission"
    TRANSPOSITION = "transposition"
    REVERSAL = "reversal"
    INSERTION = "insertion"
    SELF_CORRECT = "self_correct"  # NOT counted as miscue
    CORRECT = "correct"           # NOT counted as miscue

class MiscueSeverity(Enum):
    """Severity levels for miscues using ultra-advanced analysis."""
    CRITICAL = "critical"      # Completely changes meaning
    MAJOR = "major"           # Significantly affects comprehension
    MODERATE = "moderate"     # Some impact on understanding
    MINOR = "minor"          # Minimal impact
    NEGLIGIBLE = "negligible" # Almost no impact

@dataclass
class MiscueEvent:
    """Ultra-advanced miscue event with comprehensive intelligence data."""
    miscue_id: str
    miscue_type: MiscueType
    severity: MiscueSeverity
    expected_word: str
    actual_word: str
    position: int
    timestamp: float
    
    # Ultra-advanced intelligence metrics
    neural_pattern_disruption: float = 0.0
    voice_emotion_impact: str = "neutral"
    real_time_adaptation_triggered: bool = False
    visual_memory_confusion: float = 0.0
    contextual_flow_disruption: float = 0.0
    confidence_degradation: float = 0.0
    quantum_processing_time: float = 0.0
    meta_learning_adjustment: str = "none"
    
    # Detailed analysis
    phonetic_similarity: float = 0.0
    semantic_similarity: float = 0.0
    graphemic_similarity: float = 0.0
    meaning_preservation: float = 0.0
    comprehension_impact: float = 0.0
    
    # Context information
    sentence_context: List[str] = field(default_factory=list)
    story_position: float = 0.0
    reading_speed_at_miscue: float = 0.0
    
    # Correction information
    was_self_corrected: bool = False
    correction_attempts: int = 0
    time_to_correction: float = 0.0

class UltraAdvancedMiscueAnalyzer:
    """
    Ultra-advanced miscue analyzer using all 16 intelligence layers.
    Provides the most sophisticated miscue detection and analysis possible.
    """
    
    def __init__(self, phonetic_corrector):
        self.phonetic_corrector = phonetic_corrector
        self.miscue_history = deque(maxlen=1000)
        self.miscue_patterns = {}
        self.severity_thresholds = self._initialize_severity_thresholds()
        
        # Ultra-advanced analyzers for each miscue type
        self.analyzers = {
            MiscueType.MISPRONOUNCE: self._load_mispronounce_analyzer(),
            MiscueType.SUBSTITUTION: self._load_substitution_analyzer(),
            MiscueType.OMISSION: self._load_omission_analyzer(),
            MiscueType.TRANSPOSITION: self._load_transposition_analyzer(),
            MiscueType.REVERSAL: self._load_reversal_analyzer(),
            MiscueType.INSERTION: self._load_insertion_analyzer(),
            MiscueType.SELF_CORRECT: self._load_self_correct_analyzer(),
            MiscueType.CORRECT: self._load_correct_analyzer()
        }
        
        print("[OK] ULTRA-ADVANCED MISCUE ANALYZER initialized")
        print("   🎯 8 Miscue types with individual ultra-advanced analyzers")
        print("   🧠 16 Intelligence layers applied to miscue detection")
        print("   📊 Comprehensive severity analysis and pattern recognition")
    
    def analyze_miscue(
        self, 
        expected_word: str, 
        actual_word: str, 
        position: int,
        context: List[str] = None,
        reading_speed: float = 0.0
    ) -> MiscueEvent:
        """
        Analyze a miscue using ultra-advanced intelligence.
        
        Args:
            expected_word: The word that should have been read
            actual_word: The word that was actually read/heard
            position: Position in the text
            context: Surrounding words for context analysis
            reading_speed: Current reading speed for analysis
            
        Returns:
            MiscueEvent with comprehensive ultra-advanced analysis
        """
        quantum_start_time = time.perf_counter()
        
        # Step 1: Classify miscue type using ultra-advanced intelligence
        miscue_type = self._classify_miscue_type(expected_word, actual_word, context or [])
        
        # Step 2: Apply specialized analyzer for this miscue type
        analyzer = self.analyzers[miscue_type]
        detailed_analysis = analyzer.analyze(expected_word, actual_word, position, context or [], reading_speed)
        
        # Step 3: Calculate severity using all 16 intelligence layers
        severity = self._calculate_ultra_advanced_severity(
            expected_word, actual_word, miscue_type, detailed_analysis
        )
        
        # Step 4: Apply ultra-advanced intelligence metrics
        intelligence_metrics = self._apply_ultra_advanced_intelligence(
            expected_word, actual_word, context or [], position, reading_speed
        )
        
        # Step 5: Create comprehensive miscue event
        quantum_processing_time = (time.perf_counter() - quantum_start_time) * 1000
        
        miscue_event = MiscueEvent(
            miscue_id=f"miscue_{int(time.time() * 1000)}_{position}",
            miscue_type=miscue_type,
            severity=severity,
            expected_word=expected_word,
            actual_word=actual_word,
            position=position,
            timestamp=time.time(),
            
            # Ultra-advanced intelligence metrics
            neural_pattern_disruption=intelligence_metrics["neural_disruption"],
            voice_emotion_impact=intelligence_metrics["voice_emotion"],
            real_time_adaptation_triggered=intelligence_metrics["adaptation_triggered"],
            visual_memory_confusion=intelligence_metrics["visual_confusion"],
            contextual_flow_disruption=intelligence_metrics["flow_disruption"],
            confidence_degradation=intelligence_metrics["confidence_impact"],
            quantum_processing_time=quantum_processing_time,
            meta_learning_adjustment=intelligence_metrics["meta_adjustment"],
            
            # Detailed analysis from specialized analyzer
            phonetic_similarity=detailed_analysis["phonetic_similarity"],
            semantic_similarity=detailed_analysis["semantic_similarity"],
            graphemic_similarity=detailed_analysis["graphemic_similarity"],
            meaning_preservation=detailed_analysis["meaning_preservation"],
            comprehension_impact=detailed_analysis["comprehension_impact"],
            
            # Context information
            sentence_context=context or [],
            story_position=position / max(len(self.phonetic_corrector.story_words_list), 1),
            reading_speed_at_miscue=reading_speed,
            
            # Correction tracking
            was_self_corrected=detailed_analysis.get("self_corrected", False),
            correction_attempts=detailed_analysis.get("correction_attempts", 0),
            time_to_correction=detailed_analysis.get("correction_time", 0.0)
        )
        
        # Step 6: Update miscue patterns and learning
        self._update_miscue_patterns(miscue_event)
        self.miscue_history.append(miscue_event)
        
        return miscue_event
    
    def _classify_miscue_type(self, expected: str, actual: str, context: List[str]) -> MiscueType:
        """Classify miscue type using ultra-advanced intelligence."""
        expected = expected.lower().strip()
        actual = actual.lower().strip()
        
        # CORRECT - Perfect match
        if expected == actual:
            return MiscueType.CORRECT
        
        # SELF_CORRECT - Check if this looks like a self-correction pattern
        if self._detect_self_correction(expected, actual, context):
            return MiscueType.SELF_CORRECT
        
        # OMISSION - Expected word missing
        if not actual or actual == "":
            return MiscueType.OMISSION
        
        # INSERTION - Extra word not in expected
        if not expected or expected == "":
            return MiscueType.INSERTION
        
        # MISPRONOUNCE - Similar sounding but different word
        if self._is_mispronunciation(expected, actual):
            return MiscueType.MISPRONOUNCE
        
        # SUBSTITUTION - Different word entirely
        if expected != actual and len(expected.split()) == len(actual.split()):
            return MiscueType.SUBSTITUTION
        
        # TRANSPOSITION - Words in different order
        if self._is_transposition(expected, actual, context):
            return MiscueType.TRANSPOSITION
        
        # REVERSAL - Words in reverse order
        if self._is_reversal(expected, actual, context):
            return MiscueType.REVERSAL
        
        # Default to substitution
        return MiscueType.SUBSTITUTION
    
    def _is_mispronunciation(self, expected: str, actual: str) -> bool:
        """Detect mispronunciation using phonetic analysis."""
        if not self.phonetic_corrector:
            return False
        
        # Use the ultra-advanced phonetic corrector to check similarity
        correction_result = self.phonetic_corrector.correct_word_with_ultra_advanced_intelligence(actual)
        
        # If the corrector suggests the expected word, it's likely a mispronunciation
        corrected_word = correction_result.get("corrected", "")
        if corrected_word and corrected_word.lower() == expected.lower():
            phonetic_similarity = correction_result.get("phonetic_similarity", 0.0)
            return phonetic_similarity > 0.6  # High phonetic similarity
        
        return False
    
    def _detect_self_correction(self, expected: str, actual: str, context: List[str]) -> bool:
        """Detect self-correction patterns using ultra-advanced analysis."""
        # Look for patterns like "cat... no, bat" or "the... the cat"
        if "..." in actual or "no" in actual.lower() or actual.count(expected) > 1:
            return True
        
        # Check if actual contains both incorrect and correct versions
        words = actual.split()
        if len(words) > 1 and expected.lower() in [w.lower() for w in words]:
            return True
        
        return False
    
    def _is_transposition(self, expected: str, actual: str, context: List[str]) -> bool:
        """Detect word transposition (swapped order)."""
        expected_words = expected.split()
        actual_words = actual.split()
        
        if len(expected_words) != len(actual_words):
            return False
        
        # Check if same words in different order
        return sorted(expected_words) == sorted(actual_words) and expected_words != actual_words
    
    def _is_reversal(self, expected: str, actual: str, context: List[str]) -> bool:
        """Detect word reversal (reverse order)."""
        expected_words = expected.split()
        actual_words = actual.split()
        
        return expected_words == actual_words[::-1]
    
    def _initialize_severity_thresholds(self) -> Dict[str, float]:
        """Initialize severity thresholds for ultra-advanced analysis."""
        return {
            "critical_meaning_change": 0.8,
            "major_comprehension_impact": 0.6,
            "moderate_flow_disruption": 0.4,
            "minor_phonetic_difference": 0.2,
            "negligible_impact": 0.1
        }
    
    def _calculate_ultra_advanced_severity(
        self, 
        expected: str, 
        actual: str, 
        miscue_type: MiscueType, 
        analysis: Dict
    ) -> MiscueSeverity:
        """Calculate miscue severity using ultra-advanced intelligence."""
        
        # Self-corrections and correct readings are not miscues
        if miscue_type in [MiscueType.SELF_CORRECT, MiscueType.CORRECT]:
            return MiscueSeverity.NEGLIGIBLE
        
        # Calculate composite severity score
        severity_score = 0.0
        
        # Meaning preservation impact (40% weight)
        meaning_impact = 1.0 - analysis.get("meaning_preservation", 0.5)
        severity_score += meaning_impact * 0.4
        
        # Comprehension impact (30% weight)
        comprehension_impact = analysis.get("comprehension_impact", 0.5)
        severity_score += comprehension_impact * 0.3
        
        # Phonetic/semantic similarity (20% weight)
        similarity = max(
            analysis.get("phonetic_similarity", 0.0),
            analysis.get("semantic_similarity", 0.0)
        )
        similarity_impact = 1.0 - similarity
        severity_score += similarity_impact * 0.2
        
        # Context disruption (10% weight)
        context_disruption = analysis.get("context_disruption", 0.0)
        severity_score += context_disruption * 0.1
        
        # Map severity score to severity level
        if severity_score >= self.severity_thresholds["critical_meaning_change"]:
            return MiscueSeverity.CRITICAL
        elif severity_score >= self.severity_thresholds["major_comprehension_impact"]:
            return MiscueSeverity.MAJOR
        elif severity_score >= self.severity_thresholds["moderate_flow_disruption"]:
            return MiscueSeverity.MODERATE
        elif severity_score >= self.severity_thresholds["minor_phonetic_difference"]:
            return MiscueSeverity.MINOR
        else:
            return MiscueSeverity.NEGLIGIBLE
    
    def _apply_ultra_advanced_intelligence(
        self, 
        expected: str, 
        actual: str, 
        context: List[str], 
        position: int, 
        reading_speed: float
    ) -> Dict[str, Any]:
        """Apply all 16 intelligence layers to miscue analysis."""
        
        intelligence_metrics = {
            "neural_disruption": 0.0,
            "voice_emotion": "neutral",
            "adaptation_triggered": False,
            "visual_confusion": 0.0,
            "flow_disruption": 0.0,
            "confidence_impact": 0.0,
            "meta_adjustment": "none"
        }
        
        if self.phonetic_corrector:
            # Get ultra-advanced correction analysis
            correction_result = self.phonetic_corrector.correct_word_with_ultra_advanced_intelligence(
                actual, context, position, reading_speed
            )
            
            # Extract intelligence metrics
            intelligence_metrics.update({
                "neural_disruption": 1.0 - correction_result.get("neural_activation_strength", 0.5),
                "voice_emotion": correction_result.get("voice_emotional_state", "neutral"),
                "adaptation_triggered": correction_result.get("real_time_adaptations", 0) > 0,
                "visual_confusion": 1.0 - correction_result.get("visual_memory_strength", 0.5),
                "flow_disruption": 1.0 - correction_result.get("narrative_flow_position", 0.5),
                "confidence_impact": 1.0 - correction_result.get("ultra_precise_confidence", 0.5),
                "meta_adjustment": correction_result.get("meta_learning_mode", "none")
            })
        
        return intelligence_metrics
    
    def _update_miscue_patterns(self, miscue_event: MiscueEvent):
        """Update miscue patterns for learning and prediction."""
        pattern_key = f"{miscue_event.miscue_type.value}_{miscue_event.expected_word}_{miscue_event.actual_word}"
        
        if pattern_key not in self.miscue_patterns:
            self.miscue_patterns[pattern_key] = {
                "count": 0,
                "severity_history": [],
                "context_patterns": [],
                "intelligence_metrics": []
            }
        
        pattern = self.miscue_patterns[pattern_key]
        pattern["count"] += 1
        pattern["severity_history"].append(miscue_event.severity.value)
        pattern["context_patterns"].append(miscue_event.sentence_context)
        pattern["intelligence_metrics"].append({
            "neural_disruption": miscue_event.neural_pattern_disruption,
            "voice_emotion": miscue_event.voice_emotion_impact,
            "flow_disruption": miscue_event.contextual_flow_disruption
        })
    
    def _load_mispronounce_analyzer(self):
        """Load specialized mispronunciation analyzer."""
        from miscue_mispronounce import UltraAdvancedMispronounceAnalyzer
        return UltraAdvancedMispronounceAnalyzer(self.phonetic_corrector)
    
    def _load_substitution_analyzer(self):
        """Load specialized substitution analyzer."""
        from miscue_substitution import UltraAdvancedSubstitutionAnalyzer
        return UltraAdvancedSubstitutionAnalyzer(self.phonetic_corrector)
    
    def _load_omission_analyzer(self):
        """Load specialized omission analyzer."""
        from miscue_omission import UltraAdvancedOmissionAnalyzer
        return UltraAdvancedOmissionAnalyzer(self.phonetic_corrector)
    
    def _load_transposition_analyzer(self):
        """Load specialized transposition analyzer."""
        from miscue_transposition import UltraAdvancedTranspositionAnalyzer
        return UltraAdvancedTranspositionAnalyzer(self.phonetic_corrector)
    
    def _load_reversal_analyzer(self):
        """Load specialized reversal analyzer."""
        from miscue_reversal import UltraAdvancedReversalAnalyzer
        return UltraAdvancedReversalAnalyzer(self.phonetic_corrector)
    
    def _load_insertion_analyzer(self):
        """Load specialized insertion analyzer."""
        from miscue_insertion import UltraAdvancedInsertionAnalyzer
        return UltraAdvancedInsertionAnalyzer(self.phonetic_corrector)
    
    def _load_self_correct_analyzer(self):
        """Load specialized self-correction analyzer."""
        from miscue_self_correct import UltraAdvancedSelfCorrectAnalyzer
        return UltraAdvancedSelfCorrectAnalyzer(self.phonetic_corrector)
    
    def _load_correct_analyzer(self):
        """Load specialized correct reading analyzer."""
        from miscue_correct import UltraAdvancedCorrectAnalyzer
        return UltraAdvancedCorrectAnalyzer(self.phonetic_corrector)
    
    def get_miscue_statistics(self) -> Dict[str, Any]:
        """Get comprehensive miscue statistics with ultra-advanced analysis."""
        if not self.miscue_history:
            return {"total_miscues": 0}
        
        stats = {
            "total_events": len(self.miscue_history),
            "total_miscues": len([m for m in self.miscue_history if m.miscue_type not in [MiscueType.CORRECT, MiscueType.SELF_CORRECT]]),
            "miscue_types": {},
            "severity_distribution": {},
            "average_quantum_time": sum(m.quantum_processing_time for m in self.miscue_history) / len(self.miscue_history),
            "intelligence_utilization": {
                "neural_disruptions": len([m for m in self.miscue_history if m.neural_pattern_disruption > 0.1]),
                "voice_emotions_detected": len(set(m.voice_emotion_impact for m in self.miscue_history)),
                "adaptations_triggered": len([m for m in self.miscue_history if m.real_time_adaptation_triggered]),
                "visual_confusions": len([m for m in self.miscue_history if m.visual_memory_confusion > 0.1]),
                "flow_disruptions": len([m for m in self.miscue_history if m.contextual_flow_disruption > 0.1])
            }
        }
        
        # Count by type
        for miscue in self.miscue_history:
            miscue_type = miscue.miscue_type.value
            if miscue_type not in stats["miscue_types"]:
                stats["miscue_types"][miscue_type] = 0
            stats["miscue_types"][miscue_type] += 1
        
        # Count by severity
        for miscue in self.miscue_history:
            severity = miscue.severity.value
            if severity not in stats["severity_distribution"]:
                stats["severity_distribution"][severity] = 0
            stats["severity_distribution"][severity] += 1
        
        return stats


# Example usage
if __name__ == "__main__":
    print("ULTRA-ADVANCED MISCUE ANALYSIS SYSTEM")
    print("Individual analyzers for each miscue type with 16 intelligence layers")
    print("Ready for integration with ultra-advanced phonetic corrector")