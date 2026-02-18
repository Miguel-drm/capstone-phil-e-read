#!/usr/bin/env python3
"""
Smart Microphone Handler with Automatic Server Detection
=========================================================

Automatically detects if local Vosk server is running and uses appropriate model:
- Local server running → Use local model (fast, offline)
- Local server not running → Use Railway model (reliable, cloud)

Features:
- Automatic server detection
- Smart fallback to Railway
- Real-time speech recognition
- Story vocabulary filtering
- Connection retry logic
- Status callbacks for UI updates

Usage:
    from smart_mic_handler import SmartMicHandler
    
    # Create handler
    handler = SmartMicHandler(
        language="english",
        story_text="The dog ran fast...",
        on_word=lambda word: print(f"Heard: {word}"),
        on_status=lambda status: print(f"Status: {status}")
    )
    
    # Start listening
    await handler.start()
    
    # Stop listening
    await handler.stop()
"""

import asyncio
import json
import pyaudio
import websockets
import re
from typing import Set, Optional, Callable, Dict, Any
from dataclasses import dataclass
from enum import Enum
from vosk_connection_manager import VoskConnectionManager

# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class MicConfig:
    """Configuration for microphone handler."""
    sample_rate: int = 16000
    chunk_size: int = 4096
    channels: int = 1
    format: int = pyaudio.paInt16


class MicStatus(Enum):
    """Microphone handler status."""
    IDLE = "idle"
    DETECTING_SERVER = "detecting_server"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    LISTENING = "listening"
    ERROR = "error"
    DISCONNECTED = "disconnected"


# ============================================================================
# SMART MICROPHONE HANDLER
# ============================================================================

class SmartMicHandler:
    """
    Smart microphone handler with automatic server detection.
    
    Automatically detects if local Vosk server is running and uses the
    appropriate model (local or Railway).
    """
    
    def __init__(
        self,
        language: str,
        story_text: str,
        on_word: Optional[Callable[[str], None]] = None,
        on_status: Optional[Callable[[str, Dict[str, Any]], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
        mic_config: Optional[MicConfig] = None,
        verbose: bool = True
    ):
        """
        Initialize smart microphone handler.
        
        Args:
            language: Language for speech recognition ("english" or "tagalog")
            story_text: Story text for vocabulary filtering
            on_word: Callback when word is recognized (word: str)
            on_status: Callback for status updates (status: str, info: dict)
            on_error: Callback for errors (error: str)
            mic_config: Microphone configuration
            verbose: Enable verbose logging
        """
        self.language = language.lower()
        self.story_text = story_text
        self.on_word = on_word
        self.on_status = on_status
        self.on_error = on_error
        self.mic_config = mic_config or MicConfig()
        self.verbose = verbose
        
        # Connection state
        self.connection_manager: Optional[VoskConnectionManager] = None
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.status = MicStatus.IDLE
        
        # Audio state
        self.audio: Optional[pyaudio.PyAudio] = None
        self.stream: Optional[pyaudio.Stream] = None
        
        # Story vocabulary
        self.story_vocabulary: Set[str] = set()
        
        # Statistics
        self.stats = {
            'words_recognized': 0,
            'words_blocked': 0,
            'recognized_words': set(),
            'server_type': None,  # 'local' or 'railway'
            'connection_time': 0.0
        }
        
        # Control flags
        self._running = False
        self._send_task: Optional[asyncio.Task] = None
        self._receive_task: Optional[asyncio.Task] = None
    
    def _log(self, message: str, level: str = "info"):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            emoji = {
                "info": "ℹ️",
                "success": "✅",
                "warning": "⚠️",
                "error": "❌",
                "mic": "🎤",
                "server": "🔌",
                "local": "🏠",
                "cloud": "☁️"
            }.get(level, "•")
            print(f"{emoji} {message}")
    
    def _update_status(self, status: MicStatus, info: Optional[Dict[str, Any]] = None):
        """Update status and call callback."""
        self.status = status
        if self.on_status:
            self.on_status(status.value, info or {})
    
    def _extract_vocabulary(self) -> Set[str]:
        """Extract vocabulary from story text."""
        vocabulary = set()
        
        # Use Dictionary API for word validation (if available)
        try:
            from dictionary_api_service import get_dictionary_service
            dictionary = get_dictionary_service()
            DICTIONARY_API_AVAILABLE = True
        except ImportError:
            dictionary = None
            DICTIONARY_API_AVAILABLE = False
        
        # Extract all words
        words = re.findall(r'\b\w+(?:\'\w+)?\b', self.story_text, re.UNICODE)
        
        for word in words:
            normalized = self._normalize_word(word)
            if not normalized or len(normalized) < 2:
                continue
            
            # Add base word
            vocabulary.add(normalized)
            
            # Add pronunciation variants from Dictionary API (if available)
            if DICTIONARY_API_AVAILABLE and dictionary:
                phonetics = dictionary.get_phonetics(normalized)
                for phonetic in phonetics:
                    # Phonetics are IPA representations, not variants
                    # Just keep the base word for now
                    pass
            
            # Add morphological variations
            if self.language == "english":
                # English: s, ed, ing
                vocabulary.add(normalized + 's')
                vocabulary.add(normalized + 'ed')
                vocabulary.add(normalized + 'ing')
            else:
                # Tagalog: ng, an, in
                vocabulary.add(normalized + 'ng')
                vocabulary.add(normalized + 'an')
                vocabulary.add(normalized + 'in')
        
        return vocabulary
    
    def _normalize_word(self, word: str) -> str:
        """Normalize word for comparison."""
        return re.sub(r'[^\w]', '', word.lower(), flags=re.UNICODE).strip()
    
    def _is_word_in_story(self, heard_word: str) -> Optional[str]:
        """Check if heard word is in story vocabulary."""
        normalized = self._normalize_word(heard_word)
        
        if not normalized or len(normalized) < 2:
            return None
        
        # Direct match
        if normalized in self.story_vocabulary:
            return normalized
        
        # Fuzzy match (simple)
        for story_word in self.story_vocabulary:
            if len(normalized) == len(story_word):
                diff = sum(c1 != c2 for c1, c2 in zip(normalized, story_word))
                if diff <= 1:  # Allow 1 character difference
                    return story_word
        
        return None
    
    def _process_word(self, heard_word: str):
        """Process a heard word and validate against story."""
        matched_word = self._is_word_in_story(heard_word)
        
        if matched_word:
            # Word is in story - output it
            self.stats['words_recognized'] += 1
            self.stats['recognized_words'].add(matched_word)
            
            if self.on_word:
                self.on_word(matched_word)
            
            if self.verbose:
                print(f"mic heard: {matched_word}")
        else:
            # Word not in story - block it
            self.stats['words_blocked'] += 1
    
    async def _send_audio(self):
        """Send audio data to WebSocket."""
        try:
            while self._running and self.websocket:
                if self.stream:
                    data = self.stream.read(
                        self.mic_config.chunk_size,
                        exception_on_overflow=False
                    )
                    await self.websocket.send(data)
                await asyncio.sleep(0.001)
        except Exception as e:
            self._log(f"Error sending audio: {e}", "error")
            if self.on_error:
                self.on_error(f"Audio send error: {e}")
    
    async def _receive_results(self):
        """Receive and process recognition results."""
        try:
            async for msg in self.websocket:
                if not self._running:
                    break
                
                try:
                    result = json.loads(msg)
                    text = result.get('text', '').strip()
                    
                    if text:
                        # Process each word
                        for word in text.split():
                            self._process_word(word)
                except json.JSONDecodeError:
                    pass  # Ignore non-JSON messages
        except websockets.exceptions.ConnectionClosed:
            self._log("WebSocket connection closed", "warning")
            self._update_status(MicStatus.DISCONNECTED)
        except Exception as e:
            self._log(f"Error receiving results: {e}", "error")
            if self.on_error:
                self.on_error(f"Receive error: {e}")
    
    async def start(self):
        """Start microphone listening with automatic server detection."""
        if self._running:
            self._log("Already running", "warning")
            return
        
        try:
            # Extract story vocabulary
            self._log("Extracting story vocabulary...", "info")
            self._update_status(MicStatus.IDLE, {"message": "Extracting vocabulary"})
            self.story_vocabulary = self._extract_vocabulary()
            self._log(f"Vocabulary loaded: {len(self.story_vocabulary)} words", "success")
            
            # Detect server and connect
            self._log("Detecting server...", "server")
            self._update_status(MicStatus.DETECTING_SERVER)
            
            import time
            start_time = time.time()
            
            self.connection_manager = VoskConnectionManager(
                language=self.language,
                verbose=self.verbose
            )
            
            # Check if local server is available
            is_local = await self.connection_manager.is_local_server_available()
            server_type = "local" if is_local else "railway"
            self.stats['server_type'] = server_type
            
            if is_local:
                self._log("Using local server (fast, offline)", "local")
            else:
                self._log("Using Railway server (cloud, reliable)", "cloud")
            
            # Connect to WebSocket
            self._log("Connecting to Vosk server...", "server")
            self._update_status(MicStatus.CONNECTING, {"server_type": server_type})
            
            self.websocket = await self.connection_manager.connect(retry=True)
            
            connection_time = time.time() - start_time
            self.stats['connection_time'] = connection_time
            
            self._log(f"Connected in {connection_time:.2f}s", "success")
            self._update_status(MicStatus.CONNECTED, {
                "server_type": server_type,
                "connection_time": connection_time
            })
            
            # Setup microphone
            self._log("Setting up microphone...", "mic")
            self.audio = pyaudio.PyAudio()
            self.stream = self.audio.open(
                format=self.mic_config.format,
                channels=self.mic_config.channels,
                rate=self.mic_config.sample_rate,
                input=True,
                frames_per_buffer=self.mic_config.chunk_size
            )
            
            self._log("Microphone ready - listening...", "mic")
            self._update_status(MicStatus.LISTENING, {
                "server_type": server_type,
                "vocabulary_size": len(self.story_vocabulary)
            })
            
            # Start audio processing
            self._running = True
            self._send_task = asyncio.create_task(self._send_audio())
            self._receive_task = asyncio.create_task(self._receive_results())
            
            # Wait for tasks to complete
            await asyncio.gather(self._send_task, self._receive_task)
            
        except Exception as e:
            self._log(f"Error starting microphone: {e}", "error")
            self._update_status(MicStatus.ERROR, {"error": str(e)})
            if self.on_error:
                self.on_error(f"Start error: {e}")
            await self.stop()
            raise
    
    async def stop(self):
        """Stop microphone listening and cleanup resources."""
        self._log("Stopping microphone...", "info")
        self._running = False
        
        # Cancel tasks
        if self._send_task:
            self._send_task.cancel()
            try:
                await self._send_task
            except asyncio.CancelledError:
                pass
        
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        
        # Close audio stream
        if self.stream:
            try:
                self.stream.stop_stream()
                self.stream.close()
            except:
                pass
            self.stream = None
        
        if self.audio:
            try:
                self.audio.terminate()
            except:
                pass
            self.audio = None
        
        # Close WebSocket
        if self.websocket:
            try:
                await self.websocket.close()
            except:
                pass
            self.websocket = None
        
        self._update_status(MicStatus.IDLE)
        self._log("Microphone stopped", "success")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get recognition statistics."""
        return {
            **self.stats,
            'recognized_words': list(self.stats['recognized_words']),
            'vocabulary_size': len(self.story_vocabulary),
            'coverage': len(self.stats['recognized_words']) / len(self.story_vocabulary) if self.story_vocabulary else 0
        }


# ============================================================================
# CONVENIENCE FUNCTION
# ============================================================================

async def listen_to_story(
    language: str,
    story_text: str,
    on_word: Optional[Callable[[str], None]] = None,
    verbose: bool = True
):
    """
    Convenience function to start listening to a story.
    
    Args:
        language: Language for speech recognition
        story_text: Story text for vocabulary filtering
        on_word: Callback when word is recognized
        verbose: Enable verbose logging
    """
    handler = SmartMicHandler(
        language=language,
        story_text=story_text,
        on_word=on_word,
        verbose=verbose
    )
    
    try:
        await handler.start()
    except KeyboardInterrupt:
        print("\n\nStopping...")
        await handler.stop()
        
        # Print statistics
        stats = handler.get_stats()
        print("\n" + "=" * 60)
        print("SESSION STATISTICS")
        print("=" * 60)
        print(f"Server Type: {stats['server_type']}")
        print(f"Connection Time: {stats['connection_time']:.2f}s")
        print(f"Words Recognized: {stats['words_recognized']}")
        print(f"Words Blocked: {stats['words_blocked']}")
        print(f"Unique Words: {len(stats['recognized_words'])}")
        print(f"Coverage: {stats['coverage']:.1%}")
        print("=" * 60)


# ============================================================================
# MAIN FUNCTION (DEMO)
# ============================================================================

async def main():
    """Demo the smart microphone handler."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Smart Microphone Handler Demo'
    )
    parser.add_argument(
        '--language',
        choices=['english', 'tagalog'],
        default='english',
        help='Language for speech recognition'
    )
    parser.add_argument(
        '--story',
        type=str,
        required=True,
        help='Story text or file path'
    )
    
    args = parser.parse_args()
    
    # Load story
    try:
        with open(args.story, 'r', encoding='utf-8') as f:
            story_text = f.read()
    except FileNotFoundError:
        # Treat as direct text
        story_text = args.story
    
    print("=" * 70)
    print("  SMART MICROPHONE HANDLER DEMO")
    print("=" * 70)
    print()
    print(f"Language: {args.language}")
    print(f"Story length: {len(story_text)} characters")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 70)
    print()
    
    # Start listening
    await listen_to_story(
        language=args.language,
        story_text=story_text,
        verbose=True
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDemo stopped by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
