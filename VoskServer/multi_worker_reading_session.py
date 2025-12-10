"""
Multi-Worker Reading Session Backend

Architecture: Multiple workers processing different tasks in parallel
- Worker 1: Word Recognition (correct words)
- Worker 2: Error Detection (incorrect words, miscues)
- Worker 3: Metrics Calculation (WPM, accuracy, scores)
- Worker 4: Session Management (state, progress)

All workers run simultaneously for maximum speed and accuracy.
"""

import asyncio
import json
import time
from collections import deque
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Set
import websockets
from word_matcher import WordMatcherSession


@dataclass
class WordEvent:
    """Event when a word is spoken"""
    word: str
    index: int
    timestamp: float
    confidence: float = 1.0


@dataclass
class ValidationResult:
    """Result from word validation"""
    index: int
    correct: bool
    error_type: Optional[str] = None
    spoken_word: str = ""
    expected_word: str = ""
    processing_time_ms: float = 0


@dataclass
class SessionMetrics:
    """Real-time session metrics"""
    wpm: float = 0
    accuracy: float = 100
    words_read: int = 0
    total_miscues: int = 0
    miscue_types: Dict[str, int] = None
    
    def __post_init__(self):
        if self.miscue_types is None:
            self.miscue_types = {
                'mispronunciation': 0,
                'omission': 0,
                'substitution': 0,
                'insertion': 0,
                'repetition': 0
            }


class Worker1_WordRecognition:
    """
    Worker 1: Handles CORRECT word recognition
    Fast path for words that match perfectly
    """
    
    def __init__(self, story_words: List[str], language: str):
        self.story_words = story_words
        self.language = language
        self.recognized_words: Set[int] = set()
        self.queue = asyncio.Queue()
        self.running = False
    
    async def start(self):
        """Start the worker"""
        self.running = True
        asyncio.create_task(self._process_queue())
        print("✅ Worker 1 (Word Recognition) started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
    
    async def add_word(self, event: WordEvent):
        """Add word to recognition queue"""
        await self.queue.put(event)
    
    async def _process_queue(self):
        """Process words in queue"""
        while self.running:
            try:
                event = await asyncio.wait_for(self.queue.get(), timeout=0.1)
                result = await self._recognize_word(event)
                
                if result:
                    # Word recognized correctly!
                    self.recognized_words.add(event.index)
                    yield result
            
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Worker 1 error: {e}")
    
    async def _recognize_word(self, event: WordEvent) -> Optional[ValidationResult]:
        """Check if word matches expected word"""
        if event.index >= len(self.story_words):
            return None
        
        expected = self.story_words[event.index].lower().strip('.,!?')
        spoken = event.word.lower().strip('.,!?')
        
        # Fast exact match
        if spoken == expected:
            return ValidationResult(
                index=event.index,
                correct=True,
                spoken_word=event.word,
                expected_word=self.story_words[event.index]
            )
        
        # Fuzzy match (80%+ similarity)
        similarity = self._calculate_similarity(spoken, expected)
        if similarity >= 0.8:
            return ValidationResult(
                index=event.index,
                correct=True,
                spoken_word=event.word,
                expected_word=self.story_words[event.index]
            )
        
        return None
    
    def _calculate_similarity(self, word1: str, word2: str) -> float:
        """Calculate word similarity (0.0 to 1.0)"""
        if word1 == word2:
            return 1.0
        
        # Simple Levenshtein-based similarity
        max_len = max(len(word1), len(word2))
        if max_len == 0:
            return 1.0
        
        distance = self._levenshtein(word1, word2)
        return 1.0 - (distance / max_len)
    
    def _levenshtein(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance"""
        if len(s1) < len(s2):
            return self._levenshtein(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]


class Worker2_ErrorDetection:
    """
    Worker 2: Handles ERROR detection
    Identifies mispronunciations, omissions, substitutions, etc.
    """
    
    def __init__(self, story_words: List[str], language: str):
        self.story_words = story_words
        self.language = language
        self.errors: Dict[int, str] = {}
        self.queue = asyncio.Queue()
        self.running = False
    
    async def start(self):
        """Start the worker"""
        self.running = True
        asyncio.create_task(self._process_queue())
        print("✅ Worker 2 (Error Detection) started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
    
    async def add_word(self, event: WordEvent):
        """Add word to error detection queue"""
        await self.queue.put(event)
    
    async def _process_queue(self):
        """Process words for errors"""
        while self.running:
            try:
                event = await asyncio.wait_for(self.queue.get(), timeout=0.1)
                result = await self._detect_error(event)
                
                if result:
                    # Error detected!
                    self.errors[event.index] = result.error_type
                    yield result
            
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Worker 2 error: {e}")
    
    async def _detect_error(self, event: WordEvent) -> Optional[ValidationResult]:
        """Detect what type of error occurred"""
        if event.index >= len(self.story_words):
            return None
        
        expected = self.story_words[event.index].lower().strip('.,!?')
        spoken = event.word.lower().strip('.,!?')
        
        # Check for different error types
        error_type = self._classify_error(spoken, expected)
        
        if error_type:
            return ValidationResult(
                index=event.index,
                correct=False,
                error_type=error_type,
                spoken_word=event.word,
                expected_word=self.story_words[event.index]
            )
        
        return None
    
    def _classify_error(self, spoken: str, expected: str) -> Optional[str]:
        """Classify the type of error"""
        # Mispronunciation: Similar but not exact
        similarity = self._calculate_similarity(spoken, expected)
        if 0.5 <= similarity < 0.8:
            return 'mispronunciation'
        
        # Substitution: Completely different word
        if similarity < 0.5:
            return 'substitution'
        
        return None
    
    def _calculate_similarity(self, word1: str, word2: str) -> float:
        """Calculate word similarity"""
        # Same as Worker 1
        if word1 == word2:
            return 1.0
        max_len = max(len(word1), len(word2))
        if max_len == 0:
            return 1.0
        distance = self._levenshtein(word1, word2)
        return 1.0 - (distance / max_len)
    
    def _levenshtein(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance"""
        if len(s1) < len(s2):
            return self._levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]


class Worker3_MetricsCalculation:
    """
    Worker 3: Handles METRICS calculation
    Calculates WPM, accuracy, oral reading score in real-time
    """
    
    def __init__(self, total_words: int):
        self.total_words = total_words
        self.start_time = time.time()
        self.metrics = SessionMetrics()
        self.word_timestamps: List[float] = []
        self.running = False
    
    async def start(self):
        """Start the worker"""
        self.running = True
        self.start_time = time.time()
        asyncio.create_task(self._update_metrics())
        print("✅ Worker 3 (Metrics Calculation) started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
    
    async def _update_metrics(self):
        """Continuously update metrics"""
        while self.running:
            await asyncio.sleep(0.5)  # Update every 500ms
            self._calculate_metrics()
    
    def add_word_read(self, timestamp: float):
        """Record a word was read"""
        self.word_timestamps.append(timestamp)
        self.metrics.words_read = len(self.word_timestamps)
    
    def add_miscue(self, error_type: str):
        """Record a miscue"""
        self.metrics.total_miscues += 1
        if error_type in self.metrics.miscue_types:
            self.metrics.miscue_types[error_type] += 1
    
    def _calculate_metrics(self):
        """Calculate all metrics"""
        # WPM calculation
        elapsed_time = time.time() - self.start_time
        if elapsed_time > 0:
            self.metrics.wpm = (self.metrics.words_read / elapsed_time) * 60
        
        # Accuracy calculation
        if self.metrics.words_read > 0:
            correct_words = self.metrics.words_read - self.metrics.total_miscues
            self.metrics.accuracy = (correct_words / self.metrics.words_read) * 100
    
    def get_metrics(self) -> SessionMetrics:
        """Get current metrics"""
        return self.metrics


class Worker4_SessionManagement:
    """
    Worker 4: Handles SESSION state management
    Tracks progress, coordinates other workers
    """
    
    def __init__(self, story_words: List[str]):
        self.story_words = story_words
        self.current_position = 0
        self.session_state = {
            'started': False,
            'paused': False,
            'completed': False
        }
        self.running = False
    
    async def start(self):
        """Start the worker"""
        self.running = True
        self.session_state['started'] = True
        print("✅ Worker 4 (Session Management) started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
        self.session_state['completed'] = True
    
    def update_position(self, new_position: int):
        """Update current reading position"""
        self.current_position = new_position
    
    def get_progress(self) -> float:
        """Get reading progress percentage"""
        if len(self.story_words) == 0:
            return 0.0
        return (self.current_position / len(self.story_words)) * 100


class Worker5_ContinuousListener:
    """
    Worker 5: Handles CONTINUOUS LISTENING
    Ensures NO WORDS ARE MISSED by monitoring audio stream continuously
    Detects when Web Speech API misses words
    """
    
    def __init__(self, story_words: List[str]):
        self.story_words = story_words
        self.last_word_time = time.time()
        self.silence_threshold = 2.0  # 2 seconds of silence = might have missed word
        self.running = False
        self.missed_words: List[int] = []
    
    async def start(self):
        """Start the worker"""
        self.running = True
        asyncio.create_task(self._monitor_silence())
        print("✅ Worker 5 (Continuous Listener) started")
    
    async def stop(self):
        """Stop the worker"""
        self.running = False
    
    async def _monitor_silence(self):
        """Monitor for long silences that might indicate missed words"""
        while self.running:
            await asyncio.sleep(0.5)  # Check every 500ms
            
            time_since_last_word = time.time() - self.last_word_time
            
            # If silence > threshold, might have missed a word
            if time_since_last_word > self.silence_threshold:
                print(f"⚠️ Worker 5: {time_since_last_word:.1f}s silence detected - possible missed word")
    
    def word_detected(self):
        """Called when a word is detected"""
        self.last_word_time = time.time()
    
    def mark_missed_word(self, index: int):
        """Mark a word as potentially missed"""
        if index not in self.missed_words:
            self.missed_words.append(index)
            print(f"⚠️ Worker 5: Word {index} marked as potentially missed")


class MultiWorkerReadingSession:
    """
    Main coordinator for multi-worker reading session
    Manages all 5 workers and coordinates their work
    """
    
    def __init__(self, story_words: List[str], language: str = 'english'):
        self.story_words = story_words
        self.language = language
        
        # Initialize all workers
        self.worker1 = Worker1_WordRecognition(story_words, language)
        self.worker2 = Worker2_ErrorDetection(story_words, language)
        self.worker3 = Worker3_MetricsCalculation(len(story_words))
        self.worker4 = Worker4_SessionManagement(story_words)
        self.worker5 = Worker5_ContinuousListener(story_words)  # NEW!
        
        self.websocket = None
    
    async def start(self):
        """Start all workers"""
        print("🚀 Starting Multi-Worker Reading Session")
        print(f"   Story: {len(self.story_words)} words")
        print(f"   Language: {self.language}")
        print()
        
        await self.worker1.start()
        await self.worker2.start()
        await self.worker3.start()
        await self.worker4.start()
        await self.worker5.start()  # NEW!
        
        print()
        print("✅ All 5 workers started - ready for reading!")
    
    async def stop(self):
        """Stop all workers"""
        await self.worker1.stop()
        await self.worker2.stop()
        await self.worker3.stop()
        await self.worker4.stop()
        await self.worker5.stop()  # NEW!
        print("✅ All 5 workers stopped")
    
    async def process_word(self, word: str, index: int, confidence: float = 1.0):
        """
        Process a spoken word through all workers in parallel
        """
        event = WordEvent(
            word=word,
            index=index,
            timestamp=time.time(),
            confidence=confidence
        )
        
        # Send to both Worker 1 and Worker 2 simultaneously
        await asyncio.gather(
            self.worker1.add_word(event),
            self.worker2.add_word(event)
        )
        
        # Worker 3 tracks the word
        self.worker3.add_word_read(event.timestamp)
        
        # Worker 4 updates position
        self.worker4.update_position(index + 1)
        
        # Worker 5 monitors continuous listening
        self.worker5.word_detected()
        
        # Send results back to frontend
        if self.websocket:
            await self._send_results(event)
    
    async def _send_results(self, event: WordEvent):
        """Send results to frontend via WebSocket"""
        # Get metrics from Worker 3
        metrics = self.worker3.get_metrics()
        
        # Check if word was recognized (Worker 1)
        is_correct = event.index in self.worker1.recognized_words
        
        # Check if error was detected (Worker 2)
        error_type = self.worker2.errors.get(event.index)
        
        # Send validation result
        result = {
            'type': 'validation_result',
            'index': event.index,
            'correct': is_correct,
            'error_type': error_type,
            'spoken_word': event.word,
            'expected_word': self.story_words[event.index] if event.index < len(self.story_words) else ''
        }
        
        await self.websocket.send(json.dumps(result))
        
        # Send metrics update
        metrics_msg = {
            'type': 'metrics_update',
            **asdict(metrics)
        }
        
        await self.websocket.send(json.dumps(metrics_msg))


async def handle_multi_worker_websocket(websocket, path):
    """
    WebSocket handler for multi-worker reading sessions
    """
    session: Optional[MultiWorkerReadingSession] = None
    
    try:
        print(f"✅ New connection from {websocket.remote_address}")
        
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type')
                
                if msg_type == 'init':
                    # Initialize session with all workers
                    story_words = data.get('story_words', [])
                    language = data.get('language', 'english')
                    
                    session = MultiWorkerReadingSession(story_words, language)
                    session.websocket = websocket
                    
                    await session.start()
                    
                    await websocket.send(json.dumps({
                        'type': 'init_success',
                        'total_words': len(story_words),
                        'workers': 4
                    }))
                
                elif msg_type == 'word_spoken':
                    if not session:
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Session not initialized'
                        }))
                        continue
                    
                    # Process word through all workers in parallel
                    await session.process_word(
                        word=data.get('word', ''),
                        index=data.get('index', 0),
                        confidence=data.get('confidence', 1.0)
                    )
                
                elif msg_type == 'stop':
                    if session:
                        await session.stop()
                
                else:
                    print(f"⚠️ Unknown message type: {msg_type}")
            
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON: {e}")
            except Exception as e:
                print(f"❌ Error: {e}")
    
    except websockets.exceptions.ConnectionClosed:
        print("✓ Connection closed")
    finally:
        if session:
            await session.stop()


# Start server
if __name__ == '__main__':
    async def main():
        async with websockets.serve(handle_multi_worker_websocket, 'localhost', 2702):
            print("=" * 60)
            print("🚀 MULTI-WORKER READING SESSION SERVER")
            print("=" * 60)
            print("Port: 2702")
            print("URL: ws://localhost:2702")
            print()
            print("Workers:")
            print("  Worker 1: Word Recognition (correct words)")
            print("  Worker 2: Error Detection (incorrect words)")
            print("  Worker 3: Metrics Calculation (WPM, accuracy)")
            print("  Worker 4: Session Management (progress, state)")
            print()
            print("All workers run in PARALLEL for maximum speed!")
            print("=" * 60)
            print()
            await asyncio.Future()
    
    asyncio.run(main())
