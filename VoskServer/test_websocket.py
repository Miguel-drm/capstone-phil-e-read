#!/usr/bin/env python3
"""
Test script for VoskServer WebSocket connection.
This script connects to your Railway-deployed WebSocket server and tests it.
"""
import asyncio
import json
import sys
import websockets
import argparse

async def test_websocket(url):
    """Test WebSocket connection to VoskServer."""
    print(f"Connecting to {url}...")
    
    try:
        async with websockets.connect(url, ping_interval=None) as websocket:
            print("✓ Connected successfully!")
            print("\nSending test audio data (silence)...")
            print("(In a real scenario, you would send PCM16 audio bytes here)")
            
            # Send some test data (silence - all zeros)
            # PCM16 mono at 16kHz: 16000 samples per second
            # Send 1 second of silence (32000 bytes = 16000 samples * 2 bytes per sample)
            silence = b'\x00\x00' * 16000  # 1 second of silence
            
            await websocket.send(silence)
            print("✓ Sent test audio data")
            
            # Wait for response
            print("\nWaiting for response...")
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"✓ Received response: {json.dumps(data, indent=2)}")
                
                if "text" in data:
                    print(f"\nRecognized text: '{data['text']}'")
                elif "partial" in data:
                    print(f"\nPartial result: '{data['partial']}'")
                    
            except asyncio.TimeoutError:
                print("⚠ No response received (this is normal for silence)")
            
            print("\n✓ WebSocket connection test successful!")
            print("\nYour server is working correctly!")
            print(f"You can now connect from your frontend using: {url}")
            
    except websockets.exceptions.InvalidURI:
        print(f"✗ Error: Invalid WebSocket URL: {url}")
        print("  Make sure to use 'ws://' or 'wss://' protocol")
        sys.exit(1)
    except websockets.exceptions.ConnectionClosed:
        print("✗ Error: Connection closed unexpectedly")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error connecting: {e}")
        print("\nTroubleshooting:")
        print("1. Check that your Railway service is running")
        print("2. Verify the URL is correct")
        print("3. Check Railway logs for errors")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Test VoskServer WebSocket connection")
    parser.add_argument(
        "url",
        nargs="?",
        help="WebSocket URL (e.g., wss://your-app.railway.app or ws://localhost:2700)"
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="Test local server (ws://localhost:2700)"
    )
    
    args = parser.parse_args()
    
    if args.local:
        url = "ws://localhost:2700"
    elif args.url:
        url = args.url
    else:
        print("VoskServer WebSocket Tester")
        print("=" * 50)
        print("\nUsage:")
        print("  python test_websocket.py <websocket-url>")
        print("  python test_websocket.py --local")
        print("\nExamples:")
        print("  python test_websocket.py wss://vosk-server.railway.app")
        print("  python test_websocket.py ws://localhost:2700")
        print("  python test_websocket.py --local")
        print("\nTo get your Railway WebSocket URL:")
        print("1. Go to Railway Dashboard")
        print("2. Click on your service")
        print("3. Copy the 'Public URL'")
        print("4. Replace 'https://' with 'wss://'")
        print("   Example: https://vosk-server.railway.app → wss://vosk-server.railway.app")
        sys.exit(1)
    
    # Ensure URL uses ws:// or wss://
    if url.startswith("http://"):
        url = url.replace("http://", "ws://")
    elif url.startswith("https://"):
        url = url.replace("https://", "wss://")
    elif not url.startswith(("ws://", "wss://")):
        url = f"wss://{url}"
    
    print("VoskServer WebSocket Tester")
    print("=" * 50)
    asyncio.run(test_websocket(url))

if __name__ == "__main__":
    main()

