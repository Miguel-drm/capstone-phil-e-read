#!/usr/bin/env python3
"""
Tagalog Reading Session Validator with Auto-Generated Pronunciation Dictionary
===============================================================================

This script provides a complete reading session system that:
1. Accepts a story text as input
2. Automatically generates pronunciation variants for each word
3. Listens to real-time microphone input
4. Validates spoken words against the story
5. Marks words as correct or miscue
6. Ignores background noise and non-story words

Features:
- Auto-generates child pronunciation variants
- Real-time validation: "mic heard: <word> → correct/miscue"
- Story-constrained recognition
- Optimized for children's speech patterns

Usage:
    python reading_session_validator.py --story "path/to/story.txt"
    
    Or with inline story:
    python reading_session_validator.py --text "Ang aso ay kumain ng karne"

Requirements:
    pip install websockets pyaudio asyncio

Author: AI Developer
Date: 2024
"""

import asyncio
import json
import pyaudio
import websockets
import re
import argparse
from typing import Set, Dict, List, Optional
from difflib import get_close_matches

# ============================================================================
# CONFIGURATION
# ============================================================================

VOSK_SERVER = "wss://philiready-websocket-production.up.railway.app"
SAMPLE_RATE = 16000
CHUNK_SIZE = 4096

# ============================================================================
# AUTO-GENERATE PRONUNCIATION VARIANTS
# ============================================================================

def generate_pronunciation_variants(word: str) -> List[str]:
    """
    Automatically generate likely child mispronunciations for a Tagalog word.
    
    Generates variants based on common patterns:
    1. Vowel substitutions (a→o, i→e, u→o)
    2. Dropped syllables
    3. Added suffixes (-ng, -an, -in)
    4. Removed suffixes
    5. Consonant changes
    
    Args:
        word: Canonical Tagalog word
        
    Returns:
        List of pronunciation variants including the original
    """
    normalized = word.lower().strip()
    variants = {normalized}  # Start with original
    
    # Pattern 1: Add common Tagalog suffixes
    variants.add(normalized + 'ng')
    variants.add(normalized + 'an')
    variants.add(normalized + 'in')
    variants.add(normalized + 'ang')
    
    # Pattern 2: Remove common suffixes
    for suffix in ['ng', 'an', 'in', 'ang']:
        if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
            variants.add(normalized[:-len(suffix)])
    
    # Pattern 3: Vowel substitutions (common in child speech)
    vowel_map = {
        'a': ['o', 'e'],
        'e': ['i', 'a'],
        'i': ['e', 'y'],
        'o': ['u', 'a'],
        'u': ['o', 'i']
    }
    
    for i, char in enumerate(normalized):
        if char in vowel_map:
            for replacement in vowel_map[char]:
                variant = normalized[:i] + replacement + normalized[i+1:]
                variants.add(variant)
    
    # Pattern 4: Dropped final vowel (common in fast speech)
    if len(normalized) > 2 and normalized[-1] in 'aeiou':
        variants.add(normalized[:-1])
    
    # Pattern 5: Double consonants to single (e.g., "buksan" → "buksan")
    # Already handled by original word
    
    # Pattern 6: Common prefix variations
    if normalized.startswith('mag'):
        variants.add('nag' + normalized[3:])
    if normalized.startswith('nag'):
        variants.add('mag' + normalized[3:])
    if normalized.startswith('um'):
        variants.add('m' + normalized[2:])
    
    # Pattern 7: Compound word splits
    if len(normalized) >= 6:
        mid = len(normalized) // 2
        variants.add(normalized[:mid])
        variants.add(normalized[mid:])
    
    # Filter out very short variants (< 2 chars)
    variants = {v for v in variants if len(v) >= 2}
    
    return sorted(list(variants))


def build_pronunciation_dictionary(story_text: str) -> Dict[str, List[str]]:
    """
    Build a pronunciation dictionary from story text.
    
    Extracts all unique words and generates pronunciation variants for each.
    
    Args:
        story_text: Complete story text
        
    Returns:
        Dictionary mapping canonical words to pronunciation variants
    """
    # Extract all words from story
    words = re.findall(r'\b\w+\b', story_text, re.UNICODE)
    unique_words = set(word.lower().strip() for word in words if len(word) >= 2)
    
    # Generate pronunciation dictionary
    pronunciation_dict = {}
    for word in sorted(unique_words):
        variants = generate_pronunciation_variants(word)
        pronunciation_dict[word] = variants
    
    return pronunciation_dict


# ============================================================================
# WORD VALIDATION
# ============================================================================

def normalize_word(word: str) -> str:
    """Normalize a word for comparison."""
    return re.sub(r'[^\w]', '', word.lower(), flags=re.UNICODE).strip()


def find_canonical_word(heard_word: str, 
                       pronunciation_dict: Dict[str, List[str]]) -> Optional[str]:
    """
    Find the canonical word for a heard word using the pronunciation dictionary.
    
    Args:
        heard_word: Word heard from microphone
        pronunciation_dict: Dictionary of canonical words and their variants
        
    Returns:
        Canonical word if match found, None otherwise
    """
    normalized = normalize_word(heard_word)
    
    if not normalized or len(normalized) < 2:
        return None
    
    # Strategy 1: Check if heard word matches any variant
    for canonical, variants in pronunciation_dict.items():
        if normalized in variants:
            return canonical
    
    # Strategy 2: Fuzzy matching (85% similarity)
    all_variants = []
    canonical_map = {}
    for canonical, variants in pronunciation_dict.items():
        for variant in variants:
            all_variants.append(variant)
            canonical_map[variant] = canonical
    
    matches = get_close_matches(normalized, all_variants, n=1, cutoff=0.85)
    if matches:
        return canonical_map[matches[0]]
    
    return None


def is_correct_word(heard_word: str, 
                   expected_word: str,
                   pronunciation_dict: Dict[str, List[str]]) -> bool:
    """
    Check if heard word matches expected word (including variants).
    
    Args:
        heard_word: Word heard from microphone
        expected_word: Expected word from story
        pronunciation_dict: Dictionary of canonical words and their variants
        
    Returns:
        True if match (correct), False if miscue
    """
    canonical = find_canonical_word(heard_word, pronunciation_dict)
    expected_normalized = normalize_word(expected_word)
    
    return canonical == expected_normalized


# ============================================================================
# REAL-TIME SPEECH RECOGNITION
# ============================================================================

class ReadingSessionValidator:
    """
    Main class for reading session validation with real-time speech recognition.
    """
    
    def __init__(self, story_text: str):
        """
        Initialize validator with story text.
        
        Args:
            story_text: Complete story text
        """
        self.story_text = story_text
        self.pronunciation_dict = build_pronunciation_dictionary(story_text)
        self.story_words = list(self.pronunciation_dict.keys())
        self.current_word_index = 0
        
        # Statistics
        self.stats = {
            'words_correct': 0,
            'words_miscue': 0,
            'words_blocked': 0
        }
    
    def get_expected_word(self) -> Optional[str]:
        """Get the current expected word from story."""
        if self.current_word_index < len(self.story_words):
            return self.story_words[self.current_word_index]
        return None
    
    def process_heard_word(self, heard_word: str) -> None:
        """
        Process a word heard from microphone and validate it.
        
        Args:
            heard_word: Word detected by speech recognition
        """
        # Find canonical form
        canonical = find_canonical_word(heard_word, self.pronunciation_dict)
        
        if canonical is None:
            # Word not in story - block it
            self.stats['words_blocked'] += 1
            print(f"[BLOCKED] {heard_word} (not in story)")
            return
        
        # Get expected word
        expected = self.get_expected_word()
        
        if expected is None:
            # Story completed
            print(f"mic heard: {heard_word} → story completed")
            return
        
        # Check if correct
        if canonical == expected:
            # Correct word
            self.stats['words_correct'] += 1
            print(f"mic heard: {heard_word} → correct (matched: {canonical})")
            self.current_word_index += 1
        else:
            # Miscue - wrong word
            self.stats['words_miscue'] += 1
            print(f"mic heard: {heard_word} → miscue (said: {canonical}, expected: {expected})")
    
    async def run_recognition(self):
        """
        Run real-time speech recognition and validation.
        """
        # Setup microphone
        audio = pyaudio.PyAudio()
        stream = audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE
        )
        
        print("=" * 70)
        print("  TAGALOG READING SESSION VALIDATOR")
        print("=" * 70)
        print()
        print(f"📖 Story loaded: {len(self.story_words)} unique words")
        print(f"📚 Pronunciation dictionary: {sum(len(v) for v in self.pronunciation_dict.values())} total variants")
        print()
        print("🎤 Microphone ready - start reading!")
        print()
        print("Format:")
        print("  ✅ mic heard: <word> → correct")
        print("  ❌ mic heard: <word> → miscue")
        print("  🚫 [BLOCKED] <word> (not in story)")
        print()
        print("=" * 70)
        print()
        
        try:
            # Connect to Vosk WebSocket
            uri = f"{VOSK_SERVER}?lang=tagalog"
            async with websockets.connect(uri) as ws:
                
                # Send audio data
                async def send():
                    while True:
                        data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                        await ws.send(data)
                        await asyncio.sleep(0.001)
                
                # Receive and process results
                async def receive():
                    async for msg in ws:
                        result = json.loads(msg)
                        text = result.get('text', '').strip()
                        
                        if text:
                            # Process each word
                            for word in text.split():
                                self.process_heard_word(word)
                
                # Run both tasks
                await asyncio.gather(send(), receive())
                
        except KeyboardInterrupt:
            print("\n")
            print("=" * 70)
            print("  SESSION SUMMARY")
            print("=" * 70)
            print()
            print(f"📊 Statistics:")
            print(f"   Words Correct: {self.stats['words_correct']}")
            print(f"   Words Miscue: {self.stats['words_miscue']}")
            print(f"   Words Blocked: {self.stats['words_blocked']}")
            print()
            
            total_read = self.stats['words_correct'] + self.stats['words_miscue']
            if total_read > 0:
                accuracy = (self.stats['words_correct'] / total_read) * 100
                print(f"   Accuracy: {accuracy:.1f}%")
            
            print(f"   Progress: {self.current_word_index}/{len(self.story_words)} words")
            print()
            
        finally:
            stream.stop_stream()
            stream.close()
            audio.terminate()


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def load_story_from_file(filepath: str) -> str:
    """Load story text from a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ Error: Story file not found: {filepath}")
        exit(1)
    except Exception as e:
        print(f"❌ Error reading story file: {e}")
        exit(1)


def main():
    """Entry point for the reading session validator."""
    parser = argparse.ArgumentParser(
        description='Tagalog Reading Session Validator with Auto-Generated Pronunciation Dictionary'
    )
    parser.add_argument(
        '--story',
        type=str,
        help='Path to story text file'
    )
    parser.add_argument(
        '--text',
        type=str,
        help='Story text as string (alternative to --story)'
    )
    parser.add_argument(
        '--show-dictionary',
        action='store_true',
        help='Display the auto-generated pronunciation dictionary'
    )
    
    args = parser.parse_args()
    
    # Get story text
    if args.story:
        story_text = load_story_from_file(args.story)
    elif args.text:
        story_text = args.text
    else:
        # Default example story
        story_text = """
        Ang Aso sa Lungga
        
        May isang aso na kumain ng karne. Pumunta siya sa ilog upang uminom ng tubig.
        Habang naglalakad, nakita niya ang kanyang sarili sa tubig.
        """
        print("ℹ️  Using default example story")
        print("   (Use --story <file> or --text '<text>' to provide your own)")
        print()
    
    # Create validator
    validator = ReadingSessionValidator(story_text)
    
    # Show dictionary if requested
    if args.show_dictionary:
        print("=" * 70)
        print("  AUTO-GENERATED PRONUNCIATION DICTIONARY")
        print("=" * 70)
        print()
        
        for i, (canonical, variants) in enumerate(sorted(validator.pronunciation_dict.items()), 1):
            variants_str = ", ".join(variants[:10])  # Show first 10 variants
            if len(variants) > 10:
                variants_str += f" ... ({len(variants)} total)"
            print(f"{i:3d}. {canonical:20s} → [{variants_str}]")
        
        print()
        print(f"Total: {len(validator.pronunciation_dict)} words, "
              f"{sum(len(v) for v in validator.pronunciation_dict.values())} variants")
        print()
        print("=" * 70)
        print()
    
    # Run recognition
    try:
        asyncio.run(validator.run_recognition())
    except KeyboardInterrupt:
        print("\n\nSession ended.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Check microphone connection")
        print("2. Verify internet connection")
        print("3. Ensure Vosk server is accessible")


if __name__ == "__main__":
    main()
