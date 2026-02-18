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

VOSK_SERVER_TAGALOG = "wss://philiready-websocket-production.up.railway.app?lang=tagalog"
VOSK_SERVER_ENGLISH = "wss://philiready-websocket-production.up.railway.app?lang=english"
SAMPLE_RATE = 16000
CHUNK_SIZE = 4096
