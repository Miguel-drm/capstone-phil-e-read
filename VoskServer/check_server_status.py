#!/usr/bin/env python3
"""
Vosk Server Status Checker
Simple script to check if the Vosk server is running and accessible
"""

import asyncio
import websockets
import json
import sys
import argparse
from datetime import datetime

async def check_server_status(host='localhost', port=2700, timeout=5):
    """
    Check if Vosk server is running and responsive
    
    Args:
        host: Server host (default: localhost)
        port: Server port (default: 2700)
        timeout: Connection timeout in seconds (default: 5)
    
    Returns:
        dict: Status information
    """
    uri = f"ws://{host}:{port}"
    status = {
        'timestamp': datetime.now().isoformat(),
        'host': host,
        'port': port,
        'uri': uri,
        'is_running': False,
        'is_responsive': False,
        'error': None,
        'response_time_ms': None
    }
    
    try:
        print(f"Checking Vosk server at {uri}...")
        
        start_time = asyncio.get_event_loop().time()
        
        # Try to connect to WebSocket
        async with websockets.connect(uri) as websocket:
            status['is_running'] = True
            
            # Send a test message
            test_message = {
                "config": {
                    "sample_rate": 16000,
                    "words": 1
                }
            }
            
            await websocket.send(json.dumps(test_message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2)
                response_data = json.loads(response)
                
                end_time = asyncio.get_event_loop().time()
                status['response_time_ms'] = round((end_time - start_time) * 1000, 2)
                status['is_responsive'] = True
                
                print(f"Server is running and responsive")
                print(f"   Response time: {status['response_time_ms']}ms")
                
            except asyncio.TimeoutError:
                status['error'] = 'Server connected but not responsive (timeout)'
                print(f"Server connected but not responsive")
                
            except json.JSONDecodeError as e:
                status['error'] = f'Invalid JSON response: {e}'
                print(f"Server responded with invalid JSON")
                
    except ConnectionRefusedError:
        status['error'] = 'Connection refused - server not running'
        print(f"Connection refused - server not running on {uri}")
        
    except asyncio.TimeoutError:
        status['error'] = 'Connection timeout'
        print(f"Connection timeout - server not reachable at {uri}")
        
    except Exception as e:
        status['error'] = str(e)
        print(f"Error: {e}")
    
    return status

def print_status_report(status):
    """Print a detailed status report"""
    print("\n" + "="*60)
    print("VOSK SERVER STATUS REPORT")
    print("="*60)
    print(f"Timestamp: {status['timestamp']}")
    print(f"Server URI: {status['uri']}")
    print(f"Running: {'✅ YES' if status['is_running'] else '❌ NO'}")
    print(f"Responsive: {'✅ YES' if status['is_responsive'] else '❌ NO'}")
    
    if status['response_time_ms']:
        print(f"Response Time: {status['response_time_ms']}ms")
    
    if status['error']:
        print(f"Error: {status['error']}")
    
    print("\nRECOMMENDATIONS:")
    
    if not status['is_running']:
        print("• Start the Vosk server: python server.py")
        print("• Check if port 2700 is available")
        print("• Verify Python dependencies are installed")
        print("• Check firewall settings")
    elif not status['is_responsive']:
        print("• Server is running but not responding properly")
        print("• Check server logs for errors")
        print("• Try restarting the server")
        print("• Verify Vosk models are loaded correctly")
    else:
        print("• Server is running correctly!")
        print("• You can now use Vosk speech recognition")
    
    print("="*60)

def get_troubleshooting_tips():
    """Get troubleshooting tips"""
    return [
        "COMMON ISSUES AND SOLUTIONS:",
        "",
        "1. 'Connection refused' error:",
        "   - Server is not running",
        "   - Run: python server.py",
        "   - Wait for 'Server started' message",
        "",
        "2. 'Port already in use' error:",
        "   - Another process is using port 2700",
        "   - Run: python kill_port_2700.py",
        "   - Or restart your computer",
        "",
        "3. 'Module not found' error:",
        "   - Missing Python dependencies",
        "   - Run: pip install -r requirements.txt",
        "   - Activate virtual environment if using one",
        "",
        "4. 'Model not found' error:",
        "   - Vosk models not downloaded",
        "   - Run: python download_huggingface_model.py",
        "   - Wait for download to complete",
        "",
        "5. Server starts but not responsive:",
        "   - Check server logs for errors",
        "   - Verify model files are not corrupted",
        "   - Try restarting the server",
        "",
        "6. High response time (>1000ms):",
        "   - Server may be overloaded",
        "   - Check system resources (CPU, RAM)",
        "   - Consider using smaller model",
        "",
        "For more help, check the README.md file or server logs."
    ]

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Check Vosk server status')
    parser.add_argument('--host', default='localhost', help='Server host (default: localhost)')
    parser.add_argument('--port', type=int, default=2700, help='Server port (default: 2700)')
    parser.add_argument('--timeout', type=int, default=5, help='Connection timeout (default: 5s)')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    parser.add_argument('--quiet', action='store_true', help='Quiet mode (minimal output)')
    parser.add_argument('--help-troubleshoot', action='store_true', help='Show troubleshooting tips')
    
    args = parser.parse_args()
    
    if args.help_troubleshoot:
        tips = get_troubleshooting_tips()
        for tip in tips:
            print(tip)
        return
    
    # Check server status
    status = await check_server_status(args.host, args.port, args.timeout)
    
    if args.json:
        # JSON output for programmatic use
        print(json.dumps(status, indent=2))
    elif args.quiet:
        # Quiet mode - just exit code
        sys.exit(0 if status['is_running'] and status['is_responsive'] else 1)
    else:
        # Full report
        print_status_report(status)
        
        # Show troubleshooting if there are issues
        if not (status['is_running'] and status['is_responsive']):
            print("\nFor detailed troubleshooting, run:")
            print("python check_server_status.py --help-troubleshoot")
    
    # Exit with appropriate code
    if status['is_running'] and status['is_responsive']:
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"Check cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)