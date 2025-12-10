#!/usr/bin/env python3
"""
Start Optimistic Reading Server

Starts both Vosk server (port 2700) and Optimistic Reading server (port 2701)
for testing the new optimistic UI system.

Usage:
    python start_optimistic_server.py
    python start_optimistic_server.py --port 2701
    python start_optimistic_server.py --workers 5
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from optimistic_reading_handler import handle_optimistic_reading_websocket


async def main():
    parser = argparse.ArgumentParser(description='Start Optimistic Reading WebSocket Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to (default: localhost)')
    parser.add_argument('--port', type=int, default=2701, help='Port to bind to (default: 2701)')
    parser.add_argument('--workers', type=int, default=3, help='Number of parallel workers (default: 3)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("⚡ OPTIMISTIC READING SERVER")
    print("=" * 60)
    print(f"Host: {args.host}")
    print(f"Port: {args.port}")
    print(f"Workers: {args.workers}")
    print(f"URL: ws://{args.host}:{args.port}")
    print("=" * 60)
    print()
    print("Features:")
    print("  ✓ Async word validation queue")
    print("  ✓ Parallel processing for fast readers")
    print("  ✓ Real-time metrics calculation")
    print("  ✓ Zero visual lag")
    print()
    print("Protocol:")
    print("  → Client: { type: 'init', story_words: [...], language: 'english' }")
    print("  → Client: { type: 'word_spoken', word: '...', index: 0 }")
    print("  ← Server: { type: 'validation_result', index: 0, correct: true }")
    print("  ← Server: { type: 'metrics_update', wpm: 120, accuracy: 98.5 }")
    print()
    print("=" * 60)
    print("🚀 Starting server...")
    print()
    
    try:
        import websockets
        
        async with websockets.serve(
            handle_optimistic_reading_websocket,
            args.host,
            args.port
        ):
            print(f"✅ Server running on ws://{args.host}:{args.port}")
            print()
            print("Press Ctrl+C to stop")
            print()
            
            # Run forever
            await asyncio.Future()
    
    except ImportError:
        print("❌ Error: 'websockets' library not installed")
        print()
        print("Install with: pip install websockets")
        sys.exit(1)
    
    except OSError as e:
        if 'Address already in use' in str(e):
            print(f"❌ Error: Port {args.port} is already in use")
            print()
            print(f"Try a different port: python {sys.argv[0]} --port 2702")
        else:
            print(f"❌ Error: {e}")
        sys.exit(1)
    
    except KeyboardInterrupt:
        print()
        print("✓ Server stopped")
        sys.exit(0)
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
