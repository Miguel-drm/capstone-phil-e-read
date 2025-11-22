import argparse
import asyncio
import json
import os
import urllib.parse
import websockets
import gc
from vosk import Model, KaldiRecognizer

# This server expects raw PCM16 mono at 16kHz frames (Int16) from the client
# Optimized for low memory usage (<512MB RAM)

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
    Supports lazy loading of models to optimize memory usage.
    """
    # Parse query parameters from path
    parsed = urllib.parse.urlparse(path)
    query_params = urllib.parse.parse_qs(parsed.query)
    language = query_params.get("lang", ["tagalog"])[0].lower()  # Default to tagalog
    
    # Normalize language parameter
    if language == "en":
        language = "english"
    elif language == "tl":
        language = "tagalog"
    
    # Check if model path exists
    if language not in model_paths:
        await ws.close(code=1008, reason=f"{language.capitalize()} model not available")
        return
    
    # Lazy load model if not already loaded
    if language not in models:
        print(f"⏳ Lazy loading {language} model from: {model_paths[language]}")
        try:
            models[language] = Model(model_paths[language])
            print(f"✓ {language.capitalize()} model loaded successfully")
            gc.collect()  # Free up memory after loading
        except Exception as e:
            print(f"❌ Error loading {language} model: {e}")
            await ws.close(code=1011, reason=f"Failed to load {language} model")
            return
    
    model = models[language]
    await recognize(ws, path, model)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tagalog-model", default=os.getenv("VOSK_TAGALOG_MODEL_PATH", "./model-tagalog"), help="Path to Tagalog Vosk model directory")
    parser.add_argument("--english-model", default=os.getenv("VOSK_ENGLISH_MODEL_PATH", "./model-english"), help="Path to English Vosk model directory")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "2700")))
    parser.add_argument("--lazy-load", action="store_true", default=os.getenv("VOSK_LAZY_LOAD", "true").lower() == "true", 
                       help="Load models on-demand to save memory (default: true)")
    args = parser.parse_args()

    global models, model_paths
    models = {}
    model_paths = {}
    
    # Store model paths for lazy loading
    if os.path.isdir(args.tagalog_model):
        model_paths["tagalog"] = args.tagalog_model
        print(f"✓ Tagalog model path registered: {args.tagalog_model}")
    else:
        print("⚠ Warning: Tagalog model path does not exist:", args.tagalog_model)
    
    if os.path.isdir(args.english_model):
        model_paths["english"] = args.english_model
        print(f"✓ English model path registered: {args.english_model}")
    else:
        print("⚠ Warning: English model path does not exist:", args.english_model)
    
    if not model_paths:
        print("❌ Error: No model paths found. Please ensure at least one model directory exists.")
        return
    
    # Memory optimization: Load only one model at startup (or none if lazy loading)
    if not args.lazy_load:
        # Load the first available model to ensure at least one is ready
        first_lang = list(model_paths.keys())[0]
        print(f"Loading {first_lang} model from: {model_paths[first_lang]}")
        models[first_lang] = Model(model_paths[first_lang])
        print(f"✓ {first_lang.capitalize()} model loaded")
        gc.collect()  # Force garbage collection to free memory
    else:
        print("🔧 Lazy loading enabled - models will be loaded on first use")
    
    print(f"Starting WebSocket server on port {args.port}")
    print("Available languages:", list(model_paths.keys()))
    print("Loaded models:", list(models.keys()) if models else "None (lazy loading)")
    print("Usage: ws://host:port/?lang=tagalog or ws://host:port/?lang=english")
    print(f"Memory optimization: {'Enabled' if args.lazy_load else 'Disabled'}")

    # Create a wrapper to handle both old and new websockets API
    async def wrapped_handler(ws, path=None):
        # In websockets v12+, path is None and we get it from ws.path
        if path is None:
            path = getattr(ws, 'path', '/')
        return await handler(ws, path)
    
    # Limit concurrent connections to reduce memory usage
    max_connections = int(os.getenv("MAX_CONNECTIONS", "10"))
    async with websockets.serve(
        wrapped_handler, 
        "0.0.0.0", 
        args.port, 
        max_size=None,
        max_queue=max_connections,
        ping_interval=20,
        ping_timeout=20
    ):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())