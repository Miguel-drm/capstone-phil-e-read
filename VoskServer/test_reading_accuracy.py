#!/usr/bin/env python3
"""
COMPREHENSIVE READING ACCURACY TEST

This script tests all the accuracy fixes we've implemented:
1. Word matching accuracy improvements
2. Miscue classification improvements  
3. Phonetic similarity improvements
4. Vocabulary filtering improvements
5. Position tracking improvements

Run this to verify that the accuracy issues have been resolved.
"""

import sys
import time
from typing import List, Dict, Any
from word_matcher import WordMatcherSession, classify_miscue_type, check_pronunciation_match
from utils.phil_iri import PhilIRIEngine
from server import validate_word_for_display, normalize_vocab_token


class ReadingAccuracyTester:
    """Comprehensive test suite for reading accuracy improvements."""
    
    def __init__(self):
        self.test_results = []
        self.phil_iri = PhilIRIEngine()
    
    def test_word_matching_accuracy(self):
        """Test improved word matching with pronunciation variations."""
        print("🧪 Testing Word Matching Accuracy...")
        
        test_cases = [
            # English pronunciation variations
            ("cat", "kat", True, "English mispronunciation"),
            ("the", "da", True, "English th->d variation"),
            ("three", "tree", True, "English th->t variation"),
            ("red", "led", True, "English r->l variation"),
            ("very", "bery", True, "English v->b variation"),
            
            # Tagalog pronunciation variations
            ("pusa", "busa", True, "Tagalog p->b variation"),
            ("tao", "dao", True, "Tagalog t->d variation"),
            ("kulay", "gulay", True, "Tagalog k->g variation"),
            ("Filipino", "Pilipino", True, "Tagalog f->p variation"),
            
            # Should NOT match (too different)
            ("cat", "dog", False, "Completely different words"),
            ("hello", "goodbye", False, "Unrelated words"),
        ]
        
        english_matcher = WordMatcherSession(["test"], "english")
        tagalog_matcher = WordMatcherSession(["test"], "tagalog")
        
        correct_predictions = 0
        total_tests = len(test_cases)
        
        for spoken, expected, should_match, description in test_cases:
            # Test with appropriate language matcher
            matcher = tagalog_matcher if "Tagalog" in description else english_matcher
            
            # Test pronunciation matching
            is_match = check_pronunciation_match(spoken, expected, matcher.language)
            
            # Test advanced word matching
            matcher_result = matcher._advanced_word_match(spoken, expected)
            
            # Check if our prediction matches expected result
            prediction_correct = (is_match or matcher_result) == should_match
            
            if prediction_correct:
                correct_predictions += 1
                status = "✅"
            else:
                status = "❌"
            
            print(f"   {status} {description}: '{expected}' vs '{spoken}' -> {is_match or matcher_result} (expected {should_match})")
        
        accuracy = (correct_predictions / total_tests) * 100
        print(f"\n📊 Word Matching Accuracy: {accuracy:.1f}% ({correct_predictions}/{total_tests})")
        
        self.test_results.append({
            "test": "word_matching",
            "accuracy": accuracy,
            "correct": correct_predictions,
            "total": total_tests
        })
    
    def test_miscue_classification(self):
        """Test improved miscue classification."""
        print("\n🧪 Testing Miscue Classification...")
        
        test_cases = [
            ("cat", "cat", "correct"),
            ("cat", "kat", "mispronunciation"),  # Phonetic similarity
            ("cat", "bat", "mispronunciation"),  # Similar sound
            ("cat", "dog", "substitution"),      # Different word
            ("cat", "tac", "reversal"),          # Letters reversed
            ("hello", "helo", "mispronunciation"), # Missing letter
            ("the", "da", "mispronunciation"),   # th->d variation
            ("very", "bery", "mispronunciation"), # v->b variation
        ]
        
        correct_classifications = 0
        
        for expected, spoken, expected_type in test_cases:
            classified_type = classify_miscue_type(spoken, expected)
            is_correct = classified_type == expected_type
            
            if is_correct:
                correct_classifications += 1
                status = "✅"
            else:
                status = "❌"
            
            print(f"   {status} '{expected}' → '{spoken}': {classified_type} (expected {expected_type})")
        
        accuracy = (correct_classifications / len(test_cases)) * 100
        print(f"\n📊 Miscue Classification Accuracy: {accuracy:.1f}% ({correct_classifications}/{len(test_cases)})")
        
        self.test_results.append({
            "test": "miscue_classification",
            "accuracy": accuracy,
            "correct": correct_classifications,
            "total": len(test_cases)
        })
    
    def test_phil_iri_accuracy(self):
        """Test Phil-IRI engine with improved phonetic matching."""
        print("\n🧪 Testing Phil-IRI Engine...")
        
        test_cases = [
            # Should detect as mispronunciation (not substitution)
            ("The cat sat", "The kat sat", "mispronunciation"),
            ("I love you", "I lub you", "mispronunciation"),
            ("Three birds", "Tree birds", "mispronunciation"),
            
            # Should detect as substitution
            ("The cat sat", "The dog sat", "substitution"),
            ("Red car", "Blue car", "substitution"),
        ]
        
        correct_detections = 0
        
        for target, student, expected_type in test_cases:
            result = self.phil_iri.analyze(target, student)
            annotations = result['annotated_text']
            
            # Find the changed word
            found_expected_type = False
            for annotation in annotations:
                if annotation['label'] == expected_type:
                    found_expected_type = True
                    break
            
            if found_expected_type:
                correct_detections += 1
                status = "✅"
            else:
                status = "❌"
            
            print(f"   {status} '{target}' vs '{student}': Expected {expected_type}")
            print(f"       Detected: {[a['label'] for a in annotations if a['label'] != 'correct']}")
        
        accuracy = (correct_detections / len(test_cases)) * 100
        print(f"\n📊 Phil-IRI Detection Accuracy: {accuracy:.1f}% ({correct_detections}/{len(test_cases)})")
        
        self.test_results.append({
            "test": "phil_iri",
            "accuracy": accuracy,
            "correct": correct_detections,
            "total": len(test_cases)
        })
    
    def test_vocabulary_filtering(self):
        """Test improved vocabulary filtering."""
        print("\n🧪 Testing Vocabulary Filtering...")
        
        test_cases = [
            # Should be accepted
            ("hello", True, "Normal word"),
            ("don't", True, "Contraction"),
            ("twenty-one", True, "Hyphenated word"),
            ("I", True, "Single letter word"),
            ("a", True, "Single letter article"),
            
            # Should be rejected
            ("", False, "Empty string"),
            ("   ", False, "Whitespace only"),
            ("aaaaaaaaaa", False, "Repeated characters"),
            ("supercalifragilisticexpialidocious", False, "Extremely long word"),
            ("xyz", False, "No vowels"),
            ("bcdfg", False, "No vowels"),
        ]
        
        correct_validations = 0
        
        for word, should_accept, description in test_cases:
            is_valid = validate_word_for_display(word)
            is_correct = is_valid == should_accept
            
            if is_correct:
                correct_validations += 1
                status = "✅"
            else:
                status = "❌"
            
            print(f"   {status} {description}: '{word}' -> {is_valid} (expected {should_accept})")
        
        accuracy = (correct_validations / len(test_cases)) * 100
        print(f"\n📊 Vocabulary Filtering Accuracy: {accuracy:.1f}% ({correct_validations}/{len(test_cases)})")
        
        self.test_results.append({
            "test": "vocabulary_filtering",
            "accuracy": accuracy,
            "correct": correct_validations,
            "total": len(test_cases)
        })
    
    def test_vocabulary_normalization(self):
        """Test improved vocabulary normalization."""
        print("\n🧪 Testing Vocabulary Normalization...")
        
        test_cases = [
            ("hello!", "hello", "Remove punctuation"),
            ("don't", "don't", "Preserve contractions"),
            ("twenty-one", "twenty-one", "Preserve hyphens"),
            ("Hello, World!", "hello", "Extract first word"),
            ("can't", "can't", "Preserve apostrophes"),
            ("123abc", "123abc", "Preserve numbers"),
        ]
        
        correct_normalizations = 0
        
        for input_word, expected, description in test_cases:
            normalized = normalize_vocab_token(input_word)
            is_correct = normalized == expected
            
            if is_correct:
                correct_normalizations += 1
                status = "✅"
            else:
                status = "❌"
            
            print(f"   {status} {description}: '{input_word}' -> '{normalized}' (expected '{expected}')")
        
        accuracy = (correct_normalizations / len(test_cases)) * 100
        print(f"\n📊 Vocabulary Normalization Accuracy: {accuracy:.1f}% ({correct_normalizations}/{len(test_cases)})")
        
        self.test_results.append({
            "test": "vocabulary_normalization",
            "accuracy": accuracy,
            "correct": correct_normalizations,
            "total": len(test_cases)
        })
    
    def run_all_tests(self):
        """Run all accuracy tests."""
        print("🚀 COMPREHENSIVE READING ACCURACY TEST")
        print("=" * 60)
        print("Testing all accuracy improvements...")
        print()
        
        start_time = time.time()
        
        self.test_word_matching_accuracy()
        self.test_miscue_classification()
        self.test_phil_iri_accuracy()
        self.test_vocabulary_filtering()
        self.test_vocabulary_normalization()
        
        end_time = time.time()
        
        print("\n" + "=" * 60)
        print("📊 FINAL RESULTS")
        print("=" * 60)
        
        total_accuracy = 0
        for result in self.test_results:
            accuracy = result['accuracy']
            total_accuracy += accuracy
            
            if accuracy >= 90:
                status = "🟢 EXCELLENT"
            elif accuracy >= 80:
                status = "🟡 GOOD"
            elif accuracy >= 70:
                status = "🟠 NEEDS IMPROVEMENT"
            else:
                status = "🔴 POOR"
            
            print(f"{status} {result['test']}: {accuracy:.1f}%")
        
        overall_accuracy = total_accuracy / len(self.test_results)
        
        print(f"\n🎯 OVERALL ACCURACY: {overall_accuracy:.1f}%")
        print(f"⏱️  Test Duration: {end_time - start_time:.2f} seconds")
        
        if overall_accuracy >= 85:
            print("\n✅ ACCURACY FIXES SUCCESSFUL!")
            print("   The reading session should now be much more accurate.")
        elif overall_accuracy >= 75:
            print("\n⚠️  ACCURACY PARTIALLY IMPROVED")
            print("   Some issues remain. Consider additional tuning.")
        else:
            print("\n❌ ACCURACY FIXES NEED MORE WORK")
            print("   Significant issues remain. Review the failing tests.")
        
        return self.test_results


if __name__ == "__main__":
    tester = ReadingAccuracyTester()
    results = tester.run_all_tests()
    
    # Save results
    import json
    with open("reading_accuracy_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to reading_accuracy_test_results.json")