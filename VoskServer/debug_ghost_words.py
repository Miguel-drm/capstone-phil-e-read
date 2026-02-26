#!/usr/bin/env python3
"""
Ghost Word Debugger
===================

This script helps debug "ghost words" - words that the microphone hears
that are far from what's actually being read.

Usage:
    python debug_ghost_words.py

Features:
- Real-time monitoring of recognized words
- Confidence score analysis
- Vocabulary checking
- Audio level monitoring
- Ghost word detection and logging
"""

import sys
import json
import time
from collections import defaultdict
from datetime import datetime

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    """Print a formatted header."""
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

class GhostWordDebugger:
    """Debugger for ghost word detection."""
    
    def __init__(self):
        self.stats = {
            "total_words": 0,
            "accepted_words": 0,
            "rejected_words": 0,
            "ghost_words": [],
            "confidence_scores": [],
            "word_frequency": defaultdict(int)
        }
        
        self.vocabulary = set()
        self.expected_words = []
        self.start_time = time.time()
    
    def load_story_vocabulary(self, story_text):
        """Load story vocabulary for testing."""
        print_header("LOADING STORY VOCABULARY")
        
        try:
            from story_aware_recognizer import create_story_recognizer
            
            recognizer = create_story_recognizer(story_text, "english")
            config = recognizer.get_recognition_config()
            
            self.vocabulary = set(word.lower() for word in config["vocabulary"])
            self.expected_words = config["expected_words"]
            
            print_success(f"Story vocabulary loaded")
            print_info(f"Story words: {len(recognizer.story_words)}")
            print_info(f"Enhanced vocabulary: {len(self.vocabulary)} words")
            print_info(f"First 10 story words: {', '.join(self.expected_words[:10])}")
            
            return True
            
        except Exception as e:
            print_error(f"Failed to load vocabulary: {e}")
            return False
    
    def check_word(self, word, confidence=1.0):
        """Check if a word is valid or a ghost word."""
        self.stats["total_words"] += 1
        self.stats["confidence_scores"].append(confidence)
        self.stats["word_frequency"][word.lower()] += 1
        
        word_lower = word.lower().strip()
        
        # Check if in vocabulary
        in_vocab = word_lower in self.vocabulary
        
        # Check phonetic match
        phonetic_match = False
        matched_word = None
        
        if not in_vocab and self.expected_words:
            try:
                from word_matcher import check_pronunciation_match
                
                for expected_word in self.expected_words:
                    if check_pronunciation_match(word, expected_word, "english"):
                        phonetic_match = True
                        matched_word = expected_word
                        break
            except Exception as e:
                print_warning(f"Phonetic matching failed: {e}")
        
        # Determine if ghost word
        is_ghost = not (in_vocab or phonetic_match)
        
        # Update stats
        if is_ghost:
            self.stats["rejected_words"] += 1
            self.stats["ghost_words"].append({
                "word": word,
                "confidence": confidence,
                "timestamp": time.time() - self.start_time
            })
        else:
            self.stats["accepted_words"] += 1
        
        # Print result
        print(f"\n{Colors.BOLD}Word: '{word}'{Colors.RESET}")
        print(f"  Confidence: {confidence:.2f}")
        print(f"  In vocabulary: {in_vocab}")
        print(f"  Phonetic match: {phonetic_match}")
        if matched_word:
            print(f"  Matches: '{matched_word}'")
        
        if is_ghost:
            print_error(f"GHOST WORD DETECTED")
        else:
            print_success(f"VALID WORD")
        
        return not is_ghost
    
    def analyze_confidence_scores(self):
        """Analyze confidence score distribution."""
        print_header("CONFIDENCE SCORE ANALYSIS")
        
        if not self.stats["confidence_scores"]:
            print_warning("No confidence scores recorded")
            return
        
        scores = self.stats["confidence_scores"]
        avg_conf = sum(scores) / len(scores)
        min_conf = min(scores)
        max_conf = max(scores)
        
        # Count by range
        high_conf = sum(1 for s in scores if s >= 0.80)
        med_conf = sum(1 for s in scores if 0.60 <= s < 0.80)
        low_conf = sum(1 for s in scores if s < 0.60)
        
        print_info(f"Average confidence: {avg_conf:.2f}")
        print_info(f"Min confidence: {min_conf:.2f}")
        print_info(f"Max confidence: {max_conf:.2f}")
        print()
        print_info(f"High confidence (≥0.80): {high_conf} words ({high_conf/len(scores)*100:.1f}%)")
        print_info(f"Medium confidence (0.60-0.80): {med_conf} words ({med_conf/len(scores)*100:.1f}%)")
        print_info(f"Low confidence (<0.60): {low_conf} words ({low_conf/len(scores)*100:.1f}%)")
        
        if low_conf > len(scores) * 0.3:
            print_warning("More than 30% of words have low confidence!")
            print_warning("Consider increasing confidence threshold")
    
    def print_summary(self):
        """Print debugging summary."""
        print_header("DEBUGGING SUMMARY")
        
        total = self.stats["total_words"]
        accepted = self.stats["accepted_words"]
        rejected = self.stats["rejected_words"]
        
        print_info(f"Total words processed: {total}")
        print_success(f"Accepted words: {accepted} ({accepted/total*100:.1f}%)")
        print_error(f"Rejected words (ghosts): {rejected} ({rejected/total*100:.1f}%)")
        
        # Ghost word analysis
        if self.stats["ghost_words"]:
            print()
            print_warning(f"Ghost words detected: {len(self.stats['ghost_words'])}")
            print()
            print("Recent ghost words:")
            for ghost in self.stats["ghost_words"][-10:]:
                print(f"  - '{ghost['word']}' (conf: {ghost['confidence']:.2f}, time: {ghost['timestamp']:.1f}s)")
        
        # Word frequency
        if self.stats["word_frequency"]:
            print()
            print_info("Most frequent words:")
            sorted_words = sorted(
                self.stats["word_frequency"].items(),
                key=lambda x: x[1],
                reverse=True
            )
            for word, count in sorted_words[:10]:
                in_vocab = word in self.vocabulary
                status = "✅" if in_vocab else "❌"
                print(f"  {status} '{word}': {count} times")
    
    def save_report(self, filename="ghost_word_report.txt"):
        """Save debugging report to file."""
        with open(filename, "w") as f:
            f.write("="*70 + "\n")
            f.write("GHOST WORD DEBUGGING REPORT\n")
            f.write("="*70 + "\n\n")
            
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write(f"Duration: {time.time() - self.start_time:.1f}s\n\n")
            
            f.write("STATISTICS:\n")
            f.write(f"  Total words: {self.stats['total_words']}\n")
            f.write(f"  Accepted: {self.stats['accepted_words']}\n")
            f.write(f"  Rejected: {self.stats['rejected_words']}\n\n")
            
            if self.stats["ghost_words"]:
                f.write("GHOST WORDS:\n")
                for ghost in self.stats["ghost_words"]:
                    f.write(f"  - {ghost['word']} (conf: {ghost['confidence']:.2f}, time: {ghost['timestamp']:.1f}s)\n")
                f.write("\n")
            
            if self.stats["confidence_scores"]:
                avg_conf = sum(self.stats["confidence_scores"]) / len(self.stats["confidence_scores"])
                f.write("CONFIDENCE ANALYSIS:\n")
                f.write(f"  Average: {avg_conf:.2f}\n")
                f.write(f"  Min: {min(self.stats['confidence_scores']):.2f}\n")
                f.write(f"  Max: {max(self.stats['confidence_scores']):.2f}\n\n")
            
            f.write("WORD FREQUENCY:\n")
            sorted_words = sorted(
                self.stats["word_frequency"].items(),
                key=lambda x: x[1],
                reverse=True
            )
            for word, count in sorted_words:
                in_vocab = word in self.vocabulary
                status = "VALID" if in_vocab else "GHOST"
                f.write(f"  {word}: {count} times ({status})\n")
        
        print_success(f"Report saved to {filename}")


def test_story_words():
    """Test with story words."""
    print_header("TEST 1: STORY WORDS")
    
    debugger = GhostWordDebugger()
    
    # Load story
    story = "Pam has a cat. It is on the bed."
    if not debugger.load_story_vocabulary(story):
        return
    
    # Test story words (should all be accepted)
    test_words = [
        ("Pam", 0.95),
        ("has", 0.92),
        ("a", 0.88),
        ("cat", 0.94),
        ("It", 0.91),
        ("is", 0.89),
        ("on", 0.87),
        ("the", 0.93),
        ("bed", 0.90)
    ]
    
    print_info("Testing story words (should all be accepted)...")
    for word, conf in test_words:
        debugger.check_word(word, conf)
    
    debugger.analyze_confidence_scores()
    debugger.print_summary()


def test_ghost_words():
    """Test with ghost words."""
    print_header("TEST 2: GHOST WORDS")
    
    debugger = GhostWordDebugger()
    
    # Load story
    story = "Pam has a cat. It is on the bed."
    if not debugger.load_story_vocabulary(story):
        return
    
    # Test ghost words (should all be rejected)
    test_words = [
        ("facepalm", 0.75),
        ("elephant", 0.82),
        ("computer", 0.79),
        ("hello", 0.88),
        ("world", 0.85)
    ]
    
    print_info("Testing ghost words (should all be rejected)...")
    for word, conf in test_words:
        debugger.check_word(word, conf)
    
    debugger.analyze_confidence_scores()
    debugger.print_summary()


def test_mispronunciations():
    """Test with mispronunciations."""
    print_header("TEST 3: MISPRONUNCIATIONS")
    
    debugger = GhostWordDebugger()
    
    # Load story
    story = "Pam has a cat. It is on the bed."
    if not debugger.load_story_vocabulary(story):
        return
    
    # Test mispronunciations (should be accepted via phonetic matching)
    test_words = [
        ("kat", 0.85),  # cat
        ("pem", 0.80),  # Pam
        ("haz", 0.78),  # has
        ("bad", 0.82),  # bed
    ]
    
    print_info("Testing mispronunciations (should be accepted)...")
    for word, conf in test_words:
        debugger.check_word(word, conf)
    
    debugger.analyze_confidence_scores()
    debugger.print_summary()


def test_mixed_words():
    """Test with mixed words."""
    print_header("TEST 4: MIXED WORDS")
    
    debugger = GhostWordDebugger()
    
    # Load story
    story = "Pam has a cat. It is on the bed."
    if not debugger.load_story_vocabulary(story):
        return
    
    # Test mixed words
    test_words = [
        ("Pam", 0.95),      # ✅ story word
        ("has", 0.92),      # ✅ story word
        ("elephant", 0.85), # ❌ ghost word
        ("cat", 0.94),      # ✅ story word
        ("hello", 0.88),    # ❌ ghost word
        ("kat", 0.80),      # ✅ mispronunciation
        ("computer", 0.82), # ❌ ghost word
        ("bed", 0.91),      # ✅ story word
    ]
    
    print_info("Testing mixed words...")
    for word, conf in test_words:
        debugger.check_word(word, conf)
    
    debugger.analyze_confidence_scores()
    debugger.print_summary()
    debugger.save_report()


def interactive_mode():
    """Interactive debugging mode."""
    print_header("INTERACTIVE MODE")
    
    debugger = GhostWordDebugger()
    
    # Load story
    print("Enter story text (or press Enter for default):")
    story = input("> ").strip()
    if not story:
        story = "Pam has a cat. It is on the bed."
        print_info(f"Using default story: {story}")
    
    if not debugger.load_story_vocabulary(story):
        return
    
    print()
    print_info("Enter words to test (one per line)")
    print_info("Format: word [confidence]")
    print_info("Example: cat 0.95")
    print_info("Type 'quit' to exit and see summary")
    print()
    
    while True:
        try:
            line = input("> ").strip()
            
            if line.lower() in ['quit', 'exit', 'q']:
                break
            
            if not line:
                continue
            
            parts = line.split()
            word = parts[0]
            conf = float(parts[1]) if len(parts) > 1 else 0.90
            
            debugger.check_word(word, conf)
            
        except KeyboardInterrupt:
            print()
            break
        except Exception as e:
            print_error(f"Error: {e}")
    
    debugger.analyze_confidence_scores()
    debugger.print_summary()
    debugger.save_report()


def main():
    """Main function."""
    print_header("GHOST WORD DEBUGGER")
    
    print("Select test mode:")
    print("  1. Test story words (should be accepted)")
    print("  2. Test ghost words (should be rejected)")
    print("  3. Test mispronunciations (should be accepted)")
    print("  4. Test mixed words")
    print("  5. Interactive mode")
    print("  6. Run all tests")
    print()
    
    choice = input("Enter choice (1-6): ").strip()
    
    if choice == "1":
        test_story_words()
    elif choice == "2":
        test_ghost_words()
    elif choice == "3":
        test_mispronunciations()
    elif choice == "4":
        test_mixed_words()
    elif choice == "5":
        interactive_mode()
    elif choice == "6":
        test_story_words()
        test_ghost_words()
        test_mispronunciations()
        test_mixed_words()
    else:
        print_error("Invalid choice")
        return
    
    print()
    print_success("Debugging complete!")


if __name__ == "__main__":
    main()
