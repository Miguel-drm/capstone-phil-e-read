#!/usr/bin/env python3
"""
Universal Story Reading Session - Speech Recognition System
===========================================================

Multi-language story-constrained speech recognition for children.
Supports: Tagalog, English

Features:
- Auto-detects language or accepts language parameter
- Story vocabulary extraction and validation
- Pronunciation variant matching
- Real-time microphone input
- Aggressive filtering of non-story words

Usage:
    # Tagalog story
    python story_reader.py --story-content "Ang Aso sa Lungga..." --language tagalog
    
    # English story
    python story_reader.py --story-content "The dog ran..." --language english
    
    # Auto-detect language
    python story_reader.py --story-content "The dog ran..."
"""

import asyncio
import json
import pyaudio
import websockets
import re
import argparse
from typing import Set, Optional, List, Dict
from difflib import get_close_matches

# Import both language dictionaries
try:
    from tagalog_pronunciation_dictionary import (
        match_word as match_word_tagalog,
        PRONUNCIATION_DICT as TAGALOG_DICT
    )
    TAGALOG_AVAILABLE = True
except ImportError:
    TAGALOG_AVAILABLE = False
    print("⚠️  Warning: Tagalog dictionary not available")

try:
    from english_pronunciation_dictionary import (
        match_word as match_word_english,
        PRONUNCIATION_DICT as ENGLISH_DICT
    )
    ENGLISH_AVAILABLE = True
except ImportError:
    ENGLISH_AVAILABLE = False
    print("⚠️  Warning: English dictionary not available")

# ============================================================================
# CONFIGURATION
# ============================================================================

VOSK_SERVER_TAGALOG = "wss://philiready-websocket-production.up.railway.app?lang=tagalog"
VOSK_SERVER_ENGLISH = "wss://philiready-websocket-production.up.railway.app?lang=english"
SAMPLE_RATE = 16000
CHUNK_SIZE = 4096
