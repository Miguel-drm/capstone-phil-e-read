"""
Integration Example: Anti-Ghost Filter with Vosk WebSocket Server

This example shows how to integrate the anti-ghost filtering system
into your existing Vosk WebSocket server for real-time reading assessment.

Usage:
    python vosk_integration_example.py
"""

import asyncio
import websockets
import json
from vosk import Model, KaldiRecognizer
from anti_ghost_filter import process_recognition_result, configure_filter_thresholds


class ReadingSessionState:
    """
    Maintains state for a reading session.
    
    This class tracks the current position in the story, last accepted word,
    and session metrics.
    """
    
    def __init__(self, story_words):
        self.story_words = story_words
        self.current_position = 0
        self.last_word = None
        
        # Session metrics
        self.words_read = 0
        self.miscue_counts = {
            'correct': 0,
            'omission': 0,
            'repetition': 0,
            'reversal': 0,
            'substitution': 0,
            'noise': 0
        }
        self.filtered_count = 0  # Ghost words filtered
    
    def update(self, result):
        """
        Update session state based on processing result.
        
        Args:
            result: Dict from process_recognition_result()
        """
        if result['accepted_word']:
            # Word was accepted (not filtered)
            self.current_position = result['new_position']
            self.last_word = result['last_word']
            self.miscue_counts[result['miscue_type']] += 1
            
            # Count words that advance position
            if result['miscue_type'] in ['correct', 'omission', 'reversal', 'substitution']:
                self.words_read += 1
        else:
            # Word was filtered (ghost word)
            self.filtered_count += 1
    
    def get_metrics(self):
        """Get current session metrics."""
        total_miscues = sum(
            count for miscue_type, count in self.miscue_counts.items()
            if miscue_type not in ['correct', 'noise']
        )
        
        accuracy = (self.miscue_counts['correct'] / max(self.words_read, 1)) * 100
        
        return {
            'current_position': self.current_position,
            'words_read': self.words_read,
            'total_words': len(self.story_words),
            'progress': f"{self.current_position}/{len(self.story_words)}",
            'accuracy': round(accuracy, 2),
            'miscue_counts': self.miscue_counts,
            'ghost_words_filtered': self.filtered_count
        }
    
    def is_complete(self):
        """Check if reading session is complete."""
        return self.current_position >= len(self.story_words)


async def handle_reading_session(websocket, path):
    """
    WebSocket handler for reading session with anti-ghost filtering.
    
    This is the main integration point that shows how to use the
    anti-ghost filter in your Vosk WebSocket server.
    
    Args:
        websocket: WebSocket connection
        path: WebSocket path
    """
    print(f"📞 New connection from {websocket.remote_address}")
    
    # Initialize Vosk recognizer
    # NOTE: Replace with your actual model path
    model = Model(model_name="vosk-model-small-en-us-0.15")
    recognizer = KaldiRecognizer(model, 16000)
    recognizer.SetWords(True)  # Enable word-level timestamps
    
    # Session state (will be initialized when story is received)
    session = None
    
    try:
        async for message in websocket:
            # Handle different message types
            if isinstance(message, str):
                # JSON message (story initialization or control)
                data = json.loads(message)
                
                if data.get('type') == 'init_story':
                    # Initialize reading session with story
                    story_words = data.get('story_words', [])
                    session = ReadingSessionState(story_words)
                    
                    # Optional: Configure filter thresholds based on environment
                    # configure_filter_thresholds(min_confidence=0.75, min_duration=0.15)
                    
                    print(f"📖 Story initialized: {len(story_words)} words")
                    
                    await websocket.send(json.dumps({
                        'type': 'session_initialized',
                        'total_words': len(story_words)
                    }))
                
                elif data.get('type') == 'get_metrics':
                    # Send current session metrics
                    if session:
                        metrics = session.get_metrics()
                        await websocket.send(json.dumps({
                            'type': 'metrics',
                            'data': metrics
                        }))
            
            elif isinstance(message, bytes):
                # Audio data
                if not session:
                    print("⚠️ Received audio before story initialization")
                    continue
                
                # Process audio with Vosk
                if recognizer.AcceptWaveform(message):
                    # Final recognition result
                    result = json.loads(recognizer.Result())
                    
                    if result.get('result'):
                        # ============================================================
                        # ANTI-GHOST FILTERING - Main integration point
                        # ============================================================
                        
                        processed = process_recognition_result(
                            result,
                            session.story_words,
                            session.current_position,
                            session.last_word
                        )
                        
                        # Update session state
                        session.update(processed)
                        
                        # Send result to frontend
                        response = {
                            'type': 'match_result',
                            'accepted_word': processed['accepted_word'],
                            'miscue_type': processed['miscue_type'],
                            'new_position': processed['new_position'],
                            'metrics': session.get_metrics(),
                            'is_complete': session.is_complete()
                        }
                        
                        await websocket.send(json.dumps(response))
                        
                        # Log for debugging
                        if processed['accepted_word']:
                            print(f"✅ Accepted: '{processed['accepted_word']}' → {processed['miscue_type']}")
                        else:
                            print(f"🚫 Filtered: Ghost word detected")
                        
                        # Check if session is complete
                        if session.is_complete():
                            print("🎉 Reading session complete!")
                            await websocket.send(json.dumps({
                                'type': 'session_complete',
                                'metrics': session.get_metrics()
                            }))
                
                else:
                    # Partial recognition result (optional: send to frontend for display)
                    partial = json.loads(recognizer.PartialResult())
                    if partial.get('partial'):
                        await websocket.send(json.dumps({
                            'type': 'partial',
                            'text': partial['partial']
                        }))
    
    except websockets.exceptions.ConnectionClosed:
        print(f"📴 Connection closed: {websocket.remote_address}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        await websocket.send(json.dumps({
            'type': 'error',
            'message': str(e)
        }))
    
    finally:
        print(f"👋 Session ended: {websocket.remote_address}")


async def main():
    """Start the WebSocket server."""
    print("=" * 70)
    print("Vosk WebSocket Server with Anti-Ghost Filtering")
    print("=" * 70)
    print("\n🚀 Starting server on ws://localhost:2700")
    print("📝 Waiting for connections...\n")
    
    async with websockets.serve(handle_reading_session, "localhost", 2700):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")


# ============================================================================
# FRONTEND INTEGRATION EXAMPLE (JavaScript/TypeScript)
# ============================================================================

"""
// Example frontend code to connect to the server

const ws = new WebSocket('ws://localhost:2700');

// Initialize story
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init_story',
    story_words: ['the', 'cat', 'sat', 'on', 'the', 'mat']
  }));
};

// Handle messages from server
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'session_initialized':
      console.log('Session initialized:', data.total_words, 'words');
      startAudioCapture();
      break;
    
    case 'match_result':
      if (data.accepted_word) {
        console.log('Word accepted:', data.accepted_word, '→', data.miscue_type);
        updateUI(data.new_position, data.miscue_type);
      } else {
        console.log('Ghost word filtered');
      }
      updateMetrics(data.metrics);
      break;
    
    case 'partial':
      updateMicDisplay(data.text);
      break;
    
    case 'session_complete':
      console.log('Session complete!', data.metrics);
      showResults(data.metrics);
      break;
    
    case 'error':
      console.error('Server error:', data.message);
      break;
  }
};

// Send audio data
function sendAudioChunk(audioData) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(audioData);
  }
}

// Request metrics
function getMetrics() {
  ws.send(JSON.stringify({ type: 'get_metrics' }));
}
"""
