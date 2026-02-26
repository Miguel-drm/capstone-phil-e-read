#!/usr/bin/env python3
"""
Miscue Detection Testing Tool
==============================

This tool helps you test miscue detection by:
1. Reading the story perfectly (baseline)
2. Intentionally making miscues to verify detection

Usage:
    python test_miscue_detection.py

Features:
- Perfect reading verification
- Intentional miscue testing
- Real-time feedback
- Detailed reports
"""

import sys
import json
import time
from typing import List, Dict, Tuple
from collections import defaultdict

# Color codes
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    """Print formatted header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text:^70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.RESET}\n")

def print_success(text):
    """Print success message."""
    print(f"{Colors.GREEN}✅ {text}{Colors.RESET}")

def print_warning(text):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.RESET}")

def print_error(text):
    """Print error message."""
    print(f"{Colors.RED}❌ {text}{Colors.RESET}")

def print_info(text):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.RESET}")

class MiscueTester:
    """Test miscue detection system."""
    
    def __init__(self, story_text: str):
        self.story_text = story_text
        self.story_words = []
        self.vocabulary = set()
        self.test_results = []
        
        # Load story
        self._load_story()
    
    def _load_story(self):
        """Load story and create vocabulary."""
        try:
            from story_aware_recognizer import create_story_recognizer
            
            recognizer = create_story_recognizer(self.story_text, "english")
            config = recognizer.get_recognition_config()
            
            self.story_words = config["expected_words"]
            self.vocabulary = set(word.lower() for word in config["vocabulary"])
            
            print_success(f"Story loaded: {len(self.story_words)} words")
            print_info(f"Vocabulary: {len(self.vocabulary)} words")
            
        except Exception as e:
            print_error(f"Failed to load story: {e}")
            sys.exit(1)
    
    def test_word(self, spoken_word: str, expected_word: str, position: int) -> Dict:
        """Test a single word against expected word."""
        try:
            from word_matcher import match_word
            
            result = match_word(
                spoken_word=spoken_word,
                expected_word=expected_word,
                expected_words=self.story_words,
                current_position=position,
                language="english"
            )
            
            return result
            
        except Exception as e:
            print_error(f"Error testing word: {e}")
            return {"match_type": "error", "details": str(e)}
    
    def print_word_result(self, spoken: str, expected: str, result: Dict):
        """Print word test result with color coding."""
        match_type = result.get("match_type", "unknown")
        
        # Color code by match type
        if match_type == "correct":
            color = Colors.GREEN
            icon = "✅"
        elif match_type in ["mispronunciation", "substitution"]:
            color = Colors.YELLOW
            icon = "⚠️"
        elif match_type in ["omission", "insertion"]:
            color = Colors.RED
            icon = "❌"
        elif match_type == "transposition_pending":
            color = Colors.MAGENTA
            icon = "🔄"
        elif match_type == "reversal":
            color = Colors.CYAN
            icon = "↔️"
        else:
            color = Colors.RESET
            icon = "❓"
        
        print(f"{color}{icon} Spoke: '{spoken}' | Expected: '{expected}' | Result: {match_type}{Colors.RESET}")
        print(f"   {result.get('details', 'No details')}")
    
    def test_perfect_reading(self):
        """Test 1: Perfect reading (all words correct)."""
        print_header("TEST 1: PERFECT READING")
        
        print_info("Reading story perfectly (all words correct)...")
        print()
        
        all_correct = True
        
        for i, word in enumerate(self.story_words):
            result = self.test_word(word, word, i)
            
            if result["match_type"] != "correct":
                all_correct = False
                print_error(f"Word {i+1}: '{word}' not recognized as correct!")
                self.print_word_result(word, word, result)
            else:
                print_success(f"Word {i+1}: '{word}' ✓")
        
        print()
        if all_correct:
            print_success("PERFECT READING TEST PASSED!")
            print_info("All words recognized correctly")
        else:
            print_error("PERFECT READING TEST FAILED!")
            print_warning("Some words were not recognized correctly")
        
        return all_correct
    
    def test_mispronunciations(self):
        """Test 2: Mispronunciations."""
        print_header("TEST 2: MISPRONUNCIATION DETECTION")
        
        # Test cases: (spoken, expected, position)
        test_cases = [
            ("kat", "cat", 3),      # cat → kat
            ("pem", "Pam", 0),      # Pam → pem
            ("haz", "has", 1),      # has → haz
            ("bad", "bed", 8),      # bed → bad
        ]
        
        print_info("Testing mispronunciations (should be detected)...")
        print()
        
        passed = 0
        failed = 0
        
        for spoken, expected, pos in test_cases:
            if pos < len(self.story_words):
                result = self.test_word(spoken, expected, pos)
                self.print_word_result(spoken, expected, result)
                
                if result["match_type"] == "mispronunciation":
                    passed += 1
                else:
                    failed += 1
                    print_warning(f"Expected 'mispronunciation', got '{result['match_type']}'")
                print()
        
        print()
        print_info(f"Passed: {passed}/{len(test_cases)}")
        if failed > 0:
            print_warning(f"Failed: {failed}/{len(test_cases)}")
        
        return failed == 0
    
    def test_substitutions(self):
        """Test 3: Substitutions (completely different words)."""
        print_header("TEST 3: SUBSTITUTION DETECTION")
        
        # Test cases: (spoken, expected, position)
        test_cases = [
            ("dog", "cat", 3),      # cat → dog
            ("Tom", "Pam", 0),      # Pam → Tom
            ("had", "has", 1),      # has → had
            ("mat", "bed", 8),      # bed → mat
        ]
        
        print_info("Testing substitutions (should be detected)...")
        print()
        
        passed = 0
        failed = 0
        
        for spoken, expected, pos in test_cases:
            if pos < len(self.story_words):
                result = self.test_word(spoken, expected, pos)
                self.print_word_result(spoken, expected, result)
                
                if result["match_type"] in ["substitution", "mispronunciation"]:
                    passed += 1
                else:
                    failed += 1
                    print_warning(f"Expected 'substitution', got '{result['match_type']}'")
                print()
        
        print()
        print_info(f"Passed: {passed}/{len(test_cases)}")
        if failed > 0:
            print_warning(f"Failed: {failed}/{len(test_cases)}")
        
        return failed == 0
    
    def test_omissions(self):
        """Test 4: Omissions (skipping words)."""
        print_header("TEST 4: OMISSION DETECTION")
        
        print_info("Testing omissions (skipping words)...")
        print()
        
        # Test: Skip from position 1 to position 3
        # Story: Pam has a cat
        # Read: Pam cat (skipped "has" and "a")
        
        if len(self.story_words) >= 4:
            spoken = self.story_words[3]  # "cat"
            expected = self.story_words[1]  # "has"
            
            result = self.test_word(spoken, expected, 1)
            self.print_word_result(spoken, expected, result)
            
            if result["match_type"] == "omission":
                print_success("Omission detected correctly!")
                print_info(f"Skipped words: {result.get('skipped_words', [])}")
                return True
            else:
                print_error(f"Expected 'omission', got '{result['match_type']}'")
                return False
        else:
            print_warning("Story too short to test omissions")
            return False
    
    def test_insertions(self):
        """Test 5: Insertions (adding words not in story)."""
        print_header("TEST 5: INSERTION DETECTION")
        
        # Test cases: (spoken, expected, position)
        test_cases = [
            ("big", "cat", 3),      # Insert "big" before "cat"
            ("very", "has", 1),     # Insert "very" before "has"
            ("little", "Pam", 0),   # Insert "little" before "Pam"
        ]
        
        print_info("Testing insertions (words not in story)...")
        print()
        
        passed = 0
        failed = 0
        
        for spoken, expected, pos in test_cases:
            if pos < len(self.story_words):
                result = self.test_word(spoken, expected, pos)
                self.print_word_result(spoken, expected, result)
                
                if result["match_type"] == "insertion":
                    passed += 1
                else:
                    failed += 1
                    print_warning(f"Expected 'insertion', got '{result['match_type']}'")
                print()
        
        print()
        print_info(f"Passed: {passed}/{len(test_cases)}")
        if failed > 0:
            print_warning(f"Failed: {failed}/{len(test_cases)}")
        
        return failed == 0
    
    def test_transpositions(self):
        """Test 6: Transpositions (swapping adjacent words)."""
        print_header("TEST 6: TRANSPOSITION DETECTION")
        
        print_info("Testing transpositions (word swaps)...")
        print()
        
        # Test: Swap "Pam" and "has"
        # Story: Pam has a cat
        # Read: has Pam a cat
        
        if len(self.story_words) >= 2:
            # First word: say second word
            spoken1 = self.story_words[1]  # "has"
            expected1 = self.story_words[0]  # "Pam"
            
            result1 = self.test_word(spoken1, expected1, 0)
            self.print_word_result(spoken1, expected1, result1)
            
            if result1["match_type"] == "transposition_pending":
                print_success("Transposition detected (pending confirmation)!")
                return True
            else:
                print_error(f"Expected 'transposition_pending', got '{result1['match_type']}'")
                return False
        else:
            print_warning("Story too short to test transpositions")
            return False
    
    def test_reversals(self):
        """Test 7: Reversals (letters reversed)."""
        print_header("TEST 7: REVERSAL DETECTION")
        
        # Test cases: (spoken, expected, position)
        # Note: Need words that are reversals of each other
        test_cases = [
            ("saw", "was", 0),      # was → saw
            ("no", "on", 7),        # on → no
            ("pot", "top", 0),      # top → pot
        ]
        
        print_info("Testing reversals (letters reversed)...")
        print()
        
        passed = 0
        failed = 0
        
        for spoken, expected, pos in test_cases:
            # Check if expected word exists in story
            if expected in [w.lower() for w in self.story_words]:
                result = self.test_word(spoken, expected, pos)
                self.print_word_result(spoken, expected, result)
                
                if result["match_type"] == "reversal":
                    passed += 1
                else:
                    failed += 1
                    print_warning(f"Expected 'reversal', got '{result['match_type']}'")
                print()
        
        if passed + failed == 0:
            print_warning("No reversible words in story to test")
            return True
        
        print()
        print_info(f"Passed: {passed}/{passed + failed}")
        if failed > 0:
            print_warning(f"Failed: {failed}/{passed + failed}")
        
        return failed == 0
    
    def run_all_tests(self):
        """Run all miscue detection tests."""
        print_header("MISCUE DETECTION TEST SUITE")
        
        print(f"{Colors.BOLD}Story:{Colors.RESET} {self.story_text}")
        print(f"{Colors.BOLD}Words:{Colors.RESET} {len(self.story_words)}")
        print()
        
        results = {
            "Perfect Reading": self.test_perfect_reading(),
            "Mispronunciations": self.test_mispronunciations(),
            "Substitutions": self.test_substitutions(),
            "Omissions": self.test_omissions(),
            "Insertions": self.test_insertions(),
            "Transpositions": self.test_transpositions(),
            "Reversals": self.test_reversals()
        }
        
        # Print summary
        print_header("TEST SUMMARY")
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            if result:
                print_success(f"{test_name}: PASSED")
            else:
                print_error(f"{test_name}: FAILED")
        
        print()
        print(f"{Colors.BOLD}Overall: {passed}/{total} tests passed{Colors.RESET}")
        
        if passed == total:
            print_success("ALL TESTS PASSED! 🎉")
            print_info("Miscue detection system is working correctly")
        else:
            print_warning(f"{total - passed} test(s) failed")
            print_info("Review failed tests above for details")
        
        return passed == total


def interactive_test():
    """Interactive testing mode."""
    print_header("INTERACTIVE MISCUE TESTING")
    
    # Get story
    print("Enter story text (or press Enter for default):")
    story = input("> ").strip()
    if not story:
        story = "Pam has a cat. It is on the bed."
        print_info(f"Using default story: {story}")
    
    tester = MiscueTester(story)
    
    print()
    print_info("Story words:")
    for i, word in enumerate(tester.story_words):
        print(f"  {i}: {word}")
    
    print()
    print_info("Enter test commands:")
    print_info("  test <spoken> <position> - Test a word")
    print_info("  perfect - Test perfect reading")
    print_info("  all - Run all tests")
    print_info("  quit - Exit")
    print()
    
    while True:
        try:
            line = input("> ").strip()
            
            if line.lower() in ['quit', 'exit', 'q']:
                break
            
            if line.lower() == 'perfect':
                tester.test_perfect_reading()
                continue
            
            if line.lower() == 'all':
                tester.run_all_tests()
                continue
            
            if line.startswith('test '):
                parts = line.split()
                if len(parts) >= 3:
                    spoken = parts[1]
                    position = int(parts[2])
                    
                    if 0 <= position < len(tester.story_words):
                        expected = tester.story_words[position]
                        result = tester.test_word(spoken, expected, position)
                        tester.print_word_result(spoken, expected, result)
                    else:
                        print_error(f"Position {position} out of range (0-{len(tester.story_words)-1})")
                else:
                    print_error("Usage: test <spoken> <position>")
                continue
            
            print_error("Unknown command")
            
        except KeyboardInterrupt:
            print()
            break
        except Exception as e:
            print_error(f"Error: {e}")
    
    print()
    print_success("Testing complete!")


def main():
    """Main function."""
    print_header("MISCUE DETECTION TESTER")
    
    print("Select mode:")
    print("  1. Run all tests (automated)")
    print("  2. Interactive testing")
    print()
    
    choice = input("Enter choice (1-2): ").strip()
    
    if choice == "1":
        story = "Pam has a cat. It is on the bed."
        tester = MiscueTester(story)
        tester.run_all_tests()
    elif choice == "2":
        interactive_test()
    else:
        print_error("Invalid choice")
        return
    
    print()
    print_success("Done!")


if __name__ == "__main__":
    main()
