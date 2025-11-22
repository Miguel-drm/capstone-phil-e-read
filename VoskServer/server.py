import argparse
import asyncio
import json
import os
import urllib.parse
import websockets
from vosk import Model, KaldiRecognizer

# This server expects raw PCM16 mono at 16kHz frames (Int16) from the client

async def recognize(websocket, path, model):
    sample_rate = 16000
    # Create recognizer with words (for better accuracy) and partial words enabled
    # Set max_alternatives to 0 for faster processing (we only need the best result)
    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.SetWords(True)  # Enable word-level timestamps (can help with accuracy)
    
    # Track if grammar has been set
    grammar_set = False
    
    try:
        async for message in websocket:
            # message is bytes (PCM16 LE)
            if isinstance(message, (bytes, bytearray)):
                # Process audio in chunks - Vosk works best with continuous streaming
                if recognizer.AcceptWaveform(message):
                    # Final result - send immediately for accuracy
                    res = json.loads(recognizer.Result())
                    text = res.get("text", "").strip()
                    if text:
                        await websocket.send(json.dumps({"text": text}))
                else:
                    # Partial result - send for real-time feedback
                    pres = json.loads(recognizer.PartialResult())
                    partial = pres.get("partial", "").strip()
                    if partial:
                        await websocket.send(json.dumps({"partial": partial}))
            elif isinstance(message, str):
                # Handle JSON configuration messages
                try:
                    config_msg = json.loads(message)
                    if "config" in config_msg:
                        config = config_msg["config"]
                        
                        # Check for grammar or word_list constraint
                        grammar = config.get("grammar") or config.get("word_list")
                        
                        if grammar and isinstance(grammar, list) and len(grammar) > 0:
                            # Recreate recognizer with grammar constraint
                            # This limits recognition to only the specified words
                            grammar_json = json.dumps(grammar)
                            recognizer = KaldiRecognizer(model, sample_rate, grammar_json)
                            recognizer.SetWords(True)
                            grammar_set = True
                            print(f"✓ Grammar constraint applied: {len(grammar)} words")
                            await websocket.send(json.dumps({
                                "status": "grammar_applied",
                                "word_count": len(grammar)
                            }))
                        else:
                            print("⚠ Received config but no valid grammar/word_list")
                except json.JSONDecodeError:
                    # Not JSON, might be heartbeat - ignore
                    pass
                except Exception as e:
                    print(f"Error processing config: {e}")
            else:
                # ignore other message types (like heartbeat pings)
                pass
    finally:
        # send final result on close - important for accuracy
        try:
            fres = json.loads(recognizer.FinalResult())
            text = fres.get("text", "").strip()
            if text:
                await websocket.send(json.dumps({"text": text}))
        except:
            pass

async def handler(ws, path):
    """
    WebSocket handler that selects the appropriate model based on language query parameter.
    Expected URL format: ws://host:port/?lang=tagalog or ws://host:port/?lang=english
    """
    # Parse query parameters from path
    parsed = urllib.parse.urlparse(path)
    query_params = urllib.parse.parse_qs(parsed.query)
    language = query_params.get("lang", ["tagalog"])[0].lower()  # Default to tagalog
    
    # Select model based on language
    if language == "english" or language == "en":
        model = models.get("english")
        if not model:
            await ws.close(code=1008, reason="English model not loaded")
            return
    else:  # Default to tagalog
        model = models.get("tagalog")
        if not model:
            await ws.close(code=1008, reason="Tagalog model not loaded")
            return
    
    await recognize(ws, path, model)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tagalog-model", default=os.getenv("VOSK_TAGALOG_MODEL_PATH", "./model-tagalog"), help="Path to Tagalog Vosk model directory")
    parser.add_argument("--english-model", default=os.getenv("VOSK_ENGLISH_MODEL_PATH", "./model-english"), help="Path to English Vosk model directory")
    # Railway automatically assigns PORT - use it if available, otherwise default to 2700
    port = int(os.getenv("PORT", "2700"))
    parser.add_argument("--port", type=int, default=port)
    parser.add_argument("--service-language", default=os.getenv("SERVICE_LANGUAGE", ""), help="Service language: 'tagalog' or 'english' (loads only that model)")
    args = parser.parse_args()

    global models
    models = {}
    
    # MEMORY OPTIMIZATION: Only load the model for the service's designated language
    # This prevents loading both models when only one is needed (saves ~200-250MB RAM)
    service_language = args.service_language.lower() if args.service_language else ""
    
    if service_language == "tagalog" or service_language == "tl":
        # Tagalog-only service - only load Tagalog model
        if os.path.isdir(args.tagalog_model):
            print(f"Loading Tagalog model from: {args.tagalog_model}")
            models["tagalog"] = Model(args.tagalog_model)
            print("✓ Tagalog model loaded")
        else:
            print(f"❌ Error: Tagalog model path does not exist: {args.tagalog_model}")
            print("  Tagalog recognition will not be available")
    elif service_language == "english" or service_language == "en":
        # English-only service - only load English model
        if os.path.isdir(args.english_model):
            print(f"Loading English model from: {args.english_model}")
            models["english"] = Model(args.english_model)
            print("✓ English model loaded")
        else:
            print(f"❌ Error: English model path does not exist: {args.english_model}")
            print("  English recognition will not be available")
    else:
        # Dual-language service (or no SERVICE_LANGUAGE set) - load both if available
        # This is for backward compatibility or services that need both languages
        if os.path.isdir(args.tagalog_model):
            print(f"Loading Tagalog model from: {args.tagalog_model}")
            models["tagalog"] = Model(args.tagalog_model)
            print("✓ Tagalog model loaded")
        else:
            print(f"⚠ Warning: Tagalog model path does not exist: {args.tagalog_model}")
            print("  Tagalog recognition will not be available")
        
        if os.path.isdir(args.english_model):
            print(f"Loading English model from: {args.english_model}")
            models["english"] = Model(args.english_model)
            print("✓ English model loaded")
        else:
            print(f"⚠ Warning: English model path does not exist: {args.english_model}")
            print("  English recognition will not be available")
    
    if not models:
        print("❌ Error: No models loaded. Please ensure at least one model directory exists.")
        return
    
    print(f"✓ Models loaded successfully: {list(models.keys())}")
    print(f"🚀 Starting WebSocket server on port {args.port}...")
    print("Supported languages:", list(models.keys()))
    print("Usage: ws://host:port/?lang=tagalog or ws://host:port/?lang=english")
    import sys
    sys.stdout.flush()  # Ensure messages are printed immediately

    # Create a wrapper to handle both old and new websockets API
    async def wrapped_handler(ws, path=None):
        # In websockets v12+, path is None and we get it from ws.path
        if path is None:
            path = getattr(ws, 'path', '/')
        return await handler(ws, path)
    
    try:
        print(f"🔧 Attempting to bind to 0.0.0.0:{args.port}...")
        sys.stdout.flush()
        
        async with websockets.serve(wrapped_handler, "0.0.0.0", args.port, max_size=None):
            print(f"✅ WebSocket server started successfully on port {args.port}")
            print(f"🌐 Listening on 0.0.0.0:{args.port}")
            print("📡 Ready to accept connections")
            print(f"🔗 Connect using: wss://your-service.up.railway.app/?lang={list(models.keys())[0]}")
            sys.stdout.flush()
            await asyncio.Future()  # run forever
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Error: Port {args.port} is already in use")
            print("   Another process may be using this port, or Railway assigned a different port")
            print(f"   Check the PORT environment variable (current: {args.port})")
        else:
            print(f"❌ Error starting WebSocket server: {e}")
        raise
    except Exception as e:
        print(f"❌ Fatal error starting server: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        raise