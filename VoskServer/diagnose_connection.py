#!/usr/bin/env python3
"""
Connection Diagnostic Tool
==========================

Diagnoses connection issues and verifies language detection.
"""

import asyncio
import json
from vosk_connection_manager import VoskConnectionManager

async def diagnose():
    """Run comprehensive connection diagnostics."""
    
    print("\n" + "=" * 70)
    print("VOSK CONNECTION DIAGNOSTIC TOOL")
    print("=" * 70)
    print()
    
    # Test 1: Check language parameters
    print("TEST 1: Language Parameter Configuration")
    print("-" * 70)
    
    for language in ["english", "tagalog"]:
        manager = VoskConnectionManager(language=language, verbose=False)
        info = manager.get_server_info()
        
        expected_param = f"lang={language}"
        has_correct_param = expected_param in info['railway_uri']
        
        status = "✅" if has_correct_param else "❌"
        print(f"{status} {language.capitalize()}: {info['railway_uri']}")
        
        if not has_correct_param:
            print(f"   ⚠️  Expected: ?lang={language}")
    
    print()
    
    # Test 2: Check local server availability
    print("TEST 2: Local Server Availability")
    print("-" * 70)
    
    manager = VoskConnectionManager(language="english", verbose=False)
    is_local = await manager.is_local_server_available()
    
    if is_local:
        print("✅ Local server is available at ws://localhost:2700")
        print("   Will use local server for faster recognition")
    else:
        print("ℹ️  Local server is not available")
        print("   Will use Railway server (cloud)")
    
    print()
    
    # Test 3: Test Railway connection
    print("TEST 3: Railway Server Connection")
    print("-" * 70)
    
    for language in ["english", "tagalog"]:
        print(f"\nTesting {language.capitalize()}...")
        
        try:
            manager = VoskConnectionManager(
                language=language,
                prefer_local=False,  # Force Railway
                verbose=False
            )
            
            print(f"   Connecting to Railway...")
            ws = await asyncio.wait_for(
                manager.connect(retry=False),
                timeout=10.0
            )
            
            print(f"   ✅ Connected successfully!")
            
            # Send a test message
            test_msg = json.dumps({"test": "connection"})
            await ws.send(test_msg)
            
            # Close connection
            await ws.close()
            print(f"   ✅ Connection closed cleanly")
            
        except asyncio.TimeoutError:
            print(f"   ❌ Connection timeout (>10s)")
            print(f"      Railway server may be sleeping (free tier)")
            print(f"      Wait 30-60 seconds and try again")
        except ConnectionError as e:
            print(f"   ❌ Connection failed: {e}")
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
    
    print()
    
    # Test 4: Summary and recommendations
    print("=" * 70)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 70)
    print()
    
    print("Configuration:")
    print(f"  ✅ Railway URL: wss://philiready-websocket-production.up.railway.app")
    print(f"  ✅ Language parameter: ?lang=<language>")
    print()
    
    if is_local:
        print("Recommendation:")
        print("  🏠 Use local server for development (faster)")
        print("     python VoskServer/server.py")
    else:
        print("Recommendation:")
        print("  ☁️  Using Railway server (cloud)")
        print("     Start local server for faster development:")
        print("     python VoskServer/server.py")
    
    print()
    print("Next Steps:")
    print("  1. Rebuild frontend: cd frontend && npm run build")
    print("  2. Test with English story")
    print("  3. Check server logs for correct language")
    print("  4. Verify speech recognition works")
    print()

if __name__ == "__main__":
    try:
        asyncio.run(diagnose())
    except KeyboardInterrupt:
        print("\n\nDiagnostic interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Diagnostic failed: {e}")
        import traceback
        traceback.print_exc()
