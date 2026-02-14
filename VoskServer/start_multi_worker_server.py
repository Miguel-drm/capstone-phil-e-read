#!/usr/bin/env python3
"""
Start Multi-Worker Reading Session Server

Starts the multi-worker backend on port 2702
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from multi_worker_reading_session import handle_multi_worker_websocket
import websockets


async def main():
    print("=" * 70)
    print("🚀 MULTI-WORKER READING SESSION SERVER")
    print("=" * 70)
    print()
    print("Architecture: 4 Workers Running in Parallel")
    print()
    print("  👷 Worker 1: Word Recognition")
    print("     - Catches CORRECT words")
    print("     - Fast exact matching")
    print("     - Fuzzy matching (80%+ similarity)")
    print()
    print("  👷 Worker 2: Error Detection")
    print("     - Catches INCORRECT words")
    print("     - Identifies mispronunciations")
    print("     - Detects substitutions")
    print()
    print("  👷 Worker 3: Metrics Calculation")
    print("     - Calculates WPM in real-time")
    print("     - Tracks accuracy")
    print("     - Counts miscues")
    print()
    print("  👷 Worker 4: Session Management")
    print("     - Tracks reading progress")
    print("     - Manages session state")
    print("     - Coordinates workers")
    print()
    print("=" * 70)
    print()
    print("Server Details:")
    print("  Host: localhost")
    print("  Port: 2702")
    print("  URL: ws://localhost:2702")
    print()
    print("=" * 70)
    print()
    print("🚀 Starting server...")
    print()
    
    try:
        async with websockets.serve(
            handle_multi_worker_websocket,
            'localhost',
            2702
        ):
            print("✅ Server running on ws://localhost:2702")
            print()
            print("All 4 workers ready to process reading sessions!")
            print()
            print("Press Ctrl+C to stop")
            print()
            
            await asyncio.Future()
    
    except KeyboardInterrupt:
        print()
        print("✓ Server stopped")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
