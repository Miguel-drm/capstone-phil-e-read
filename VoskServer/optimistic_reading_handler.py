"""
Optimistic Reading Handler

Handles WebSocket connections for optimistic reading sessions.
Processes words asynchronously in a queue to eliminate visual lag.

Features:
- Async word validation queue
- Parallel processing for fast readers
- Real-time metrics calculation
- Non-blocking architecture
"""

import asyncio
import json
import time
from collections import deque
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import websockets

from word_matcher import WordMatcherSession


@dataclass
class WordValidationRequest:
    """Request to validate a spoken word"""
    word: str
    index: int
    timestamp: float
    confidence: float = 1.0


@dataclass
class WordValidationResult:
    """Result of word validation"""
    index: int
    correct: bool
    error_type: Optional[str] = None
    spoken_word: Optional[str] = None
    expected_word: Optional[str] = None
    processing_time_ms: float = 0


@dataclass
class ReadingMetrics:
    """Real-time reading metrics"""
    wpm: float = 0
    accuracy: float = 100
    words_read: int = 0
    total_miscues: int = 0


class WordProcessingQueue:
    """
    Async queue for processing words without blocking.
    Handles multiple words simultaneously for fast readers.
    """
    
    def __init__(self, max_workers: int = 3):
        self.queue: deque = deque()
        self.processing = False
        self.max_workers = max_workers
        self.active_workers = 0
        self.results_callback = None
    
    async def add_word(self, request: WordValidationRequest):
        """Add word to processing queue"""
        self.queue.append(request)
        
        # Start processing if not already running
        if not self.processing:
            asyncio.create_task(self.process_queue())
    
    async def process_queue(self):
        """Process queued words with parallel workers"""
        self.processing = True
        
        while self.queue or self.active_workers > 0:
            # Spawn workers up to max_workers
            while self.queue and self.active_workers < self.max_workers:
                request = self.queue.popleft()
                self.active_workers += 1
                asyncio.create_task(self._process_word(request))
            
            # Wait a bit before checking again
            await asyncio.sleep(0.01)
        
        self.processing = False
    
    async def _process_word(self, request: WordValidationRequest):
        """Process a single word (runs in background)"""
        try:
            start_time = time.time()
            
            # Simulate word validation (replace with actual logic)
            result = await self._validate_word(request)
            
            processing_time = (time.time() - start_time) * 1000
            result.processing_time_ms = processing_time
            
            # Send result via callback
            if self.results_callback:
                await self.results_callback(result)
        
        finally:
            self.active_workers -= 1
    
    async def _validate_word(self, request: WordValidationRequest) -> WordValidationResult:
        """
        Validate a spoken word against expected word.
        This is where the actual word matching logic goes.
        """
        # TODO: Integrate with WordMatcherSession
        # For now, return a mock result
        
        # Simulate processing time
        await asyncio.sleep(0.05)
        
        return WordValidationResult(
            index=request.index,
            correct=True,  # TODO: Actual validation
            spoken_word=request.word,
            expected_word=request.word
        )


class OptimisticReadingSession:
    """
    Manages an optimistic reading session with async validation.
    """
    
    def __init__(self, story_words: List[str], language: str = 'english'):
        self.story_words = story_words
        self.language = language
        self.queue = WordProcessingQueue(max_workers=3)
        self.metrics = ReadingMetrics()
        
        # Word matcher for validation
        self.word_matcher = WordMatcherSession(story_words, language)
        
        # Tracking
        self.start_time = time.time()
        self.word_timestamps: List[float] = []
        self.validated_words: Dict[int, bool] = {}
        self.errors: Dict[int, str] = {}
    
    async def handle_word_spoken(self, word: str, index: int, timestamp: float, confidence: float = 1.0):
        """
        Handle a word spoken by the child.
        Adds to queue for async validation.
        """
        request = WordValidationRequest(
            word=word,
            index=index,
            timestamp=timestamp,
            confidence=confidence
        )
        
        await self.queue.add_word(request)
    
    async def validate_word(self, request: WordValidationRequest) -> WordValidationResult:
        """
        Validate a spoken word using word matcher.
        Runs in background thread to avoid blocking.
        """
        try:
            # Get expected word
            if request.index >= len(self.story_words):
                return WordValidationResult(
                    index=request.index,
                    correct=False,
                    error_type='out_of_bounds',
                    spoken_word=request.word
                )
            
            expected_word = self.story_words[request.index]
            
            # Use word matcher to validate
            # Run in thread pool to avoid blocking
            result = await asyncio.to_thread(
                self.word_matcher.match_word,
                request.word,
                request.index
            )
            
            # Convert word matcher result to validation result
            validation_result = WordValidationResult(
                index=request.index,
                correct=result['match_type'] == 'correct',
                error_type=result['match_type'] if result['match_type'] != 'correct' else None,
                spoken_word=request.word,
                expected_word=expected_word
            )
            
            # Update tracking
            self.validated_words[request.index] = validation_result.correct
            if not validation_result.correct:
                self.errors[request.index] = validation_result.error_type or 'unknown'
            
            self.word_timestamps.append(request.timestamp)
            
            # Update metrics
            self._update_metrics()
            
            return validation_result
        
        except Exception as e:
            print(f"Error validating word: {e}")
            return WordValidationResult(
                index=request.index,
                correct=False,
                error_type='validation_error',
                spoken_word=request.word
            )
    
    def _update_metrics(self):
        """Update real-time reading metrics"""
        elapsed_time = time.time() - self.start_time
        words_read = len(self.validated_words)
        
        # Calculate WPM
        if elapsed_time > 0:
            self.metrics.wpm = (words_read / elapsed_time) * 60
        
        # Calculate accuracy
        correct_words = sum(1 for correct in self.validated_words.values() if correct)
        if words_read > 0:
            self.metrics.accuracy = (correct_words / words_read) * 100
        
        self.metrics.words_read = words_read
        self.metrics.total_miscues = len(self.errors)
    
    def get_metrics(self) -> ReadingMetrics:
        """Get current reading metrics"""
        return self.metrics


async def handle_optimistic_reading_websocket(websocket, path):
    """
    WebSocket handler for optimistic reading sessions.
    
    Protocol:
    - Client sends: { type: 'init', story_words: [...], language: 'english' }
    - Client sends: { type: 'word_spoken', word: '...', index: 0, timestamp: 123, confidence: 0.95 }
    - Server sends: { type: 'validation_result', index: 0, correct: true, ... }
    - Server sends: { type: 'metrics_update', wpm: 120, accuracy: 98.5, ... }
    """
    
    session: Optional[OptimisticReadingSession] = None
    
    try:
        print(f"✅ New optimistic reading WebSocket connection from {websocket.remote_address}")
        
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type')
                
                if msg_type == 'init':
                    # Initialize session
                    story_words = data.get('story_words', [])
                    language = data.get('language', 'english')
                    
                    session = OptimisticReadingSession(story_words, language)
                    
                    # Set up callback to send results
                    async def send_result(result: WordValidationResult):
                        await websocket.send(json.dumps({
                            'type': 'validation_result',
                            **asdict(result)
                        }))
                        
                        # Also send updated metrics
                        metrics = session.get_metrics()
                        await websocket.send(json.dumps({
                            'type': 'metrics_update',
                            **asdict(metrics)
                        }))
                    
                    session.queue.results_callback = send_result
                    
                    # Replace validation method with actual implementation
                    session.queue._validate_word = lambda req: session.validate_word(req)
                    
                    await websocket.send(json.dumps({
                        'type': 'init_success',
                        'total_words': len(story_words)
                    }))
                    
                    print(f"✓ Session initialized: {len(story_words)} words, language: {language}")
                
                elif msg_type == 'word_spoken':
                    if not session:
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Session not initialized'
                        }))
                        continue
                    
                    # Add word to processing queue
                    await session.handle_word_spoken(
                        word=data.get('word', ''),
                        index=data.get('index', 0),
                        timestamp=data.get('timestamp', time.time()),
                        confidence=data.get('confidence', 1.0)
                    )
                
                elif msg_type == 'get_metrics':
                    if session:
                        metrics = session.get_metrics()
                        await websocket.send(json.dumps({
                            'type': 'metrics_update',
                            **asdict(metrics)
                        }))
                
                else:
                    print(f"⚠️ Unknown message type: {msg_type}")
            
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON: {e}")
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON'
                }))
            
            except Exception as e:
                print(f"❌ Error processing message: {e}")
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': str(e)
                }))
    
    except websockets.exceptions.ConnectionClosed:
        print(f"✓ WebSocket connection closed")
    
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    
    finally:
        print(f"✓ Cleaning up optimistic reading session")


# Example usage
if __name__ == '__main__':
    async def main():
        # Start WebSocket server on port 2701 (separate from Vosk on 2700)
        async with websockets.serve(handle_optimistic_reading_websocket, 'localhost', 2701):
            print("🚀 Optimistic Reading WebSocket server started on ws://localhost:2701")
            await asyncio.Future()  # Run forever
    
    asyncio.run(main())
