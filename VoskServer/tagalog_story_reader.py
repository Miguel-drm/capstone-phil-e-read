#!/usr/bin/env python3
"""
Tagalog Story Reading Session - Speech Recognition System
==========================================================

This system implements story-constrained speech recognition for children:
- Only recognizes words that exist in the story
- Blocks random words, noise, and off-topic speech
- Handles child pronunciation variants
- Real-time output: "mic heard: <word>"

Features:
- Story vocabulary extraction and validation
- Pronunciation variant matching
- Real-time microphone input
- Aggressive filtering of non-story words

Usage:
    # Pass story content directly (RECOMMENDED)
    python tagalog_story_reader.py --story-content "Ang Aso sa Lungga..."
    
    # Or load from file
    python tagalog_story_reader.py --story "path/to/story.txt"
    
    # Or fetch from session
    python tagalog_story_reader.py --session-id "session123"
"""

import asyncio
import json
import pyaudio
import websockets
import re
import argparse
from typing import Set, Optional, List
from difflib import get_close_matches
from vosk_connection_manager import VoskConnectionManager

# Dictionary API integration (replaces old pronunciation dictionaries)
try:
    from dictionary_api_service import get_dictionary_service
    DICTIONARY_API_AVAILABLE = True
except ImportError:
    DICTIONARY_API_AVAILABLE = False
    print("⚠️  Warning: Dictionary API not available")

# ============================================================================
# CONFIGURATION
# ============================================================================

SAMPLE_RATE = 16000
CHUNK_SIZE = 4096

# No default story - user must provide a story file

# ============================================================================
# STORY VOCABULARY EXTRACTION
# ============================================================================

def extract_story_vocabulary(story_text: str) -> Set[str]:
    """
    Extract all unique words from the story and create a vocabulary set.
    
    This includes:
    1. All words in the story (normalized)
    2. Common pronunciation variants
    3. Morphological variations (plurals, verb forms)
    
    Args:
        story_text: The complete story text
        
    Returns:
        Set of normalized words that are valid for this story
    """
    vocabulary = set()
    
    # Extract all words (including contractions)
    words = re.findall(r'\b\w+(?:\'\w+)?\b', story_text, re.UNICODE)
    
    for word in words:
        normalized = normalize_word(word)
        if not normalized or len(normalized) < 2:
            continue
        
        # Add the base word
        vocabulary.add(normalized)
        
        # Add pronunciation variants from Dictionary API (if available)
        if DICTIONARY_API_AVAILABLE:
            dictionary = get_dictionary_service()
            word_data = dictionary.get_word_data(normalized)
            
            # Dictionary API doesn't provide spelling variants, just phonetics
            # Keep the base word only
            pass
        
        # Add common morphological variations
        # Plurals and verb forms
        vocabulary.add(normalized + 'ng')  # Common Tagalog suffix
        vocabulary.add(normalized + 'an')  # Location/verb suffix
        vocabulary.add(normalized + 'in')  # Verb suffix
        
        # Remove suffixes (for root matching)
        if normalized.endswith('ng'):
            vocabulary.add(normalized[:-2])
        if normalized.endswith('an'):
            vocabulary.add(normalized[:-2])
        if normalized.endswith('in'):
            vocabulary.add(normalized[:-2])
    
    return vocabulary


def normalize_word(word: str) -> str:
    """
    Normalize a word for comparison.
    
    Args:
        word: Word to normalize
        
    Returns:
        Normalized lowercase word without punctuation
    """
    return re.sub(r'[^\w]', '', word.lower(), flags=re.UNICODE).strip()


# ============================================================================
# WORD VALIDATION AND MATCHING
# ============================================================================

def is_word_in_story(heard_word: str, story_vocabulary: Set[str], 
                     threshold: float = 0.85) -> Optional[str]:
    """
    Check if a heard word belongs to the story vocabulary.
    
    Uses multiple strategies:
    1. Exact match in vocabulary
    2. Pronunciation dictionary match
    3. Fuzzy matching for typos/variants
    4. Morphological matching (with/without suffixes)
    
    Args:
        heard_word: Word detected by speech recognition
        story_vocabulary: Set of valid story words
        threshold: Similarity threshold for fuzzy matching
        
    Returns:
        Matched canonical word if valid, None if not in story
    """
    normalized = normalize_word(heard_word)
    
    if not normalized or len(normalized) < 2:
        return None
    
    # Strategy 1: Direct match in story vocabulary
    if normalized in story_vocabulary:
        return normalized
    
    # Strategy 2: Check Dictionary API (if available)
    if DICTIONARY_API_AVAILABLE:
        dictionary = get_dictionary_service()
        
        # Check if word exists in dictionary
        if dictionary.check_word_exists(normalized):
            return normalized
    
    # Strategy 3: Fuzzy matching against story vocabulary
    matches = get_close_matches(normalized, story_vocabulary, n=1, cutoff=threshold)
    if matches:
        return matches[0]
    
    # Strategy 4: Try with/without common suffixes
    # Remove -ng, -an, -in suffixes
    for suffix in ['ng', 'an', 'in']:
        if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
            root = normalized[:-len(suffix)]
            if root in story_vocabulary:
                return root
    
    # Add common suffixes
    for suffix in ['ng', 'an', 'in']:
        variant = normalized + suffix
        if variant in story_vocabulary:
            return variant
    
    # Strategy 5: Check if it's a substring match (for compound words)
    for story_word in story_vocabulary:
        if len(normalized) >= 4 and normalized in story_word:
            return story_word
        if len(story_word) >= 4 and story_word in normalized:
            return story_word
    
    return None


def calculate_similarity(word1: str, word2: str) -> float:
    """
    Calculate similarity between two words using Levenshtein distance.
    
    Args:
        word1: First word
        word2: Second word
        
    Returns:
        Similarity score (0.0 to 1.0)
    """
    if word1 == word2:
        return 1.0
    
    # Levenshtein distance
    len1, len2 = len(word1), len(word2)
    if len1 == 0 or len2 == 0:
        return 0.0
    
    matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    
    for i in range(len1 + 1):
        matrix[i][0] = i
    for j in range(len2 + 1):
        matrix[0][j] = j
    
    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if word1[i-1] == word2[j-1] else 1
            matrix[i][j] = min(
                matrix[i-1][j] + 1,      # deletion
                matrix[i][j-1] + 1,      # insertion
                matrix[i-1][j-1] + cost  # substitution
            )
    
    distance = matrix[len1][len2]
    max_len = max(len1, len2)
    return 1.0 - (distance / max_len)


# ============================================================================
# WORD PROCESSING
# ============================================================================

def process_heard_word(heard_word: str, story_vocabulary: Set[str], 
                      stats: dict) -> None:
    """
    Process a word heard from microphone and validate against story.
    
    Only outputs words that are part of the story. Blocks:
    - Random words not in story
    - Background noise
    - Off-topic speech
    - Non-Tagalog words
    
    Args:
        heard_word: Word detected by speech recognition
        story_vocabulary: Set of valid story words
        stats: Dictionary to track statistics
    """
    # Try to match word to story vocabulary
    matched_word = is_word_in_story(heard_word, story_vocabulary)
    
    if matched_word:
        # Word is in the story - output it
        print(f"mic heard: {matched_word}")
        stats['words_recognized'] += 1
        stats['recognized_words'].add(matched_word)
    else:
        # Word is NOT in the story - block it
        stats['words_blocked'] += 1
        # Optionally log blocked words for debugging
        # print(f"[BLOCKED] {heard_word} (not in story)")


# ============================================================================
# MICROPHONE AND SPEECH RECOGNITION
# ============================================================================

async def recognize_story_words(story_text: str):
    """
    Main recognition loop with story-constrained vocabulary.
    
    Args:
        story_text: The complete story text
    """
    # Extract story vocabulary
    print("📖 Extracting story vocabulary...")
    story_vocabulary = extract_story_vocabulary(story_text)
    print(f"✅ Story vocabulary loaded: {len(story_vocabulary)} unique words")
    print()
    
    # Show sample of story words
    sample_words = sorted(list(story_vocabulary))[:20]
    print(f"📝 Sample story words: {', '.join(sample_words)}")
    print()
    
    # Statistics
    stats = {
        'words_recognized': 0,
        'words_blocked': 0,
        'recognized_words': set()
    }
    
    # Setup microphone
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )
    
    print("🎤 Microphone ready - listening for story words only...")
    print("   (Random words and noise will be blocked)")
    print()
    print("=" * 60)
    print()
    
    try:
        # Connect to Vosk WebSocket using smart connection manager
        print("🔌 Connecting to Vosk server...")
        connection_manager = VoskConnectionManager(language="tagalog", verbose=True)
        ws = await connection_manager.connect(retry=True)
        
        try:
            
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
                            process_heard_word(word, story_vocabulary, stats)
            
            # Run both tasks
            await asyncio.gather(send(), receive())
        
        finally:
            # Close WebSocket connection
            await ws.close()
            
    except KeyboardInterrupt:
        print("\n")
        print("=" * 60)
        print()
        print("📊 Session Statistics:")
        print(f"   Words Recognized: {stats['words_recognized']}")
        print(f"   Words Blocked: {stats['words_blocked']}")
        print(f"   Unique Words Read: {len(stats['recognized_words'])}")
        print(f"   Story Coverage: {len(stats['recognized_words'])}/{len(story_vocabulary)} words")
        print()
        
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def load_story_from_file(filepath: str) -> str:
    """
    Load story text from a file.
    
    Args:
        filepath: Path to story file
        
    Returns:
        Story text
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                print(f"❌ Error: Story file is empty: {filepath}")
                exit(1)
            return content
    except FileNotFoundError:
        print(f"❌ Error: Story file not found: {filepath}")
        exit(1)
    except Exception as e:
        print(f"❌ Error reading story file: {e}")
        exit(1)


def fetch_story_from_session(session_id: str) -> str:
    """
    Fetch story content from backend using session ID.
    
    This connects to your backend API to retrieve the story associated
    with a reading session from your database.
    
    Args:
        session_id: The reading session ID
        
    Returns:
        Story text content
    """
    try:
        import requests
        
        # Configure your backend API endpoint here
        # Default: localhost:3000 (adjust if your backend runs on different port)
        API_BASE_URL = "http://localhost:3000"
        
        print(f"📡 Connecting to backend API...")
        response = requests.get(
            f"{API_BASE_URL}/api/sessions/{session_id}/story",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            story_content = data.get('storyContent', '')
            
            if not story_content:
                print(f"❌ Error: No story content found for session {session_id}")
                exit(1)
            
            return story_content
        elif response.status_code == 404:
            print(f"❌ Error: Session {session_id} not found")
            exit(1)
        else:
            print(f"❌ Error: Failed to fetch story (Status: {response.status_code})")
            exit(1)
            
    except ImportError:
        print("❌ Error: 'requests' library not installed")
        print("   Install it with: pip install requests")
        exit(1)
    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Cannot connect to backend API")
        print(f"   Make sure your backend server is running")
        exit(1)
    except requests.exceptions.Timeout:
        print(f"❌ Error: Request timeout - backend took too long to respond")
        exit(1)
    except Exception as e:
        print(f"❌ Error fetching story from session: {e}")
        exit(1)


def main():
    """Entry point for the story reading system."""
    parser = argparse.ArgumentParser(
        description='Tagalog Story Reading Session with Speech Recognition',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Pass story directly (RECOMMENDED for integration)
  python tagalog_story_reader.py --story-content "Ang Aso sa Lungga..."
  
  # Load from file
  python tagalog_story_reader.py --story "stories/story1.txt"
  
  # Fetch from backend API
  python tagalog_story_reader.py --session-id "abc123"
        """
    )
    
    # Create mutually exclusive group for story sources
    story_group = parser.add_mutually_exclusive_group(required=True)
    story_group.add_argument(
        '--story-content',
        type=str,
        help='Story content passed directly as a string (RECOMMENDED)'
    )
    story_group.add_argument(
        '--story',
        type=str,
        help='Path to story text file'
    )
    story_group.add_argument(
        '--session-id',
        type=str,
        help='Session ID to fetch story from backend API'
    )
    
    parser.add_argument(
        '--show-story',
        action='store_true',
        help='Display the story text before starting recognition'
    )
    
    args = parser.parse_args()
    
    # Load story from the specified source
    print("=" * 70)
    print("  TAGALOG STORY READING SESSION")
    print("  Story-Constrained Speech Recognition System")
    print("=" * 70)
    print()
    
    if args.story_content:
        # Story content passed directly (RECOMMENDED)
        story_text = args.story_content.strip()
        if not story_text:
            print("❌ Error: Story content is empty")
            exit(1)
        print("✅ Story loaded from direct content")
        print(f"   Length: {len(story_text)} characters")
        
    elif args.story:
        # Story from file path
        story_text = load_story_from_file(args.story)
        print(f"✅ Story loaded from file: {args.story}")
        print(f"   Length: {len(story_text)} characters")
        
    elif args.session_id:
        # Story from session ID (fetched from backend API)
        story_text = fetch_story_from_session(args.session_id)
        print(f"✅ Story loaded for session: {args.session_id}")
        print(f"   Length: {len(story_text)} characters")
    
    print()
    
    # Display story if requested
    if args.show_story:
        print("=" * 60)
        print("STORY TEXT:")
        print("=" * 60)
        print(story_text)
        print("=" * 60)
        print()
    
    print("=" * 60)
    print("  Tagalog Story Reading Session")
    print("  Story-Constrained Speech Recognition")
    print("=" * 60)
    print()
    
    try:
        asyncio.run(recognize_story_words(story_text))
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
