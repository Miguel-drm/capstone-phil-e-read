import argparse
import asyncio
import json
import os
import urllib.parse
import websockets
import gc
import time
import sys
from vosk import Model, KaldiRecognizer

# This server expects raw PCM16 mono at 16kHz frames (Int16) from the client
# AGGRESSIVELY optimized for low memory usage (<512MB RAM on Render free tier)

# Global connection tracking for memory management
active_connections = 0
connection_timestamps = {}  # Track when connections were last active
model_last_used = {}  # Track when models were last used

async def recognize(websocket, path, model, language):
    global active_connections, connection_timestamps, model_last_used
    
    # Update connection tracking
    connection_id = id(websocket)
    active_connections += 1
    connection_timestamps[connection_id] = time.time()
    model_last_used[language] = time.time()
    
    sample_rate = 16000
    # MEMORY OPTIMIZATION: Create recognizer without words to save memory
    # SetWords(True) uses more memory - disable if not critical
    recognizer = KaldiRecognizer(model, sample_rate)
    # Only enable words if explicitly needed (uses more memory)
    enable_words = os.getenv("VOSK_ENABLE_WORDS", "false").lower() == "true"
    if enable_words:
        recognizer.SetWords(True)
    
    # Track if grammar has been set
    grammar_set = False
    
    # Connection timeout - close idle connections after 5 minutes
    connection_timeout = int(os.getenv("CONNECTION_TIMEOUT", "300"))  # 5 minutes default
    
    try:
        async for message in websocket:
            # Update last activity timestamp
            connection_timestamps[connection_id] = time.time()
            model_last_used[language] = time.time()
            
            # Check for connection timeout
            if time.time() - connection_timestamps[connection_id] > connection_timeout:
                print(f"⏱️ Connection {connection_id} timed out after {connection_timeout}s")
                await websocket.close(code=1000, reason="Connection timeout")
                break
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
        # Cleanup connection tracking
        active_connections = max(0, active_connections - 1)
        connection_timestamps.pop(connection_id, None)
        
        # send final result on close - important for accuracy
        try:
            fres = json.loads(recognizer.FinalResult())
            text = fres.get("text", "").strip()
            if text:
                await websocket.send(json.dumps({"text": text}))
        except:
            pass
        
        # Force garbage collection after connection closes
        gc.collect()

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
    
    # MEMORY OPTIMIZATION: Check connection limit before loading model
    max_connections = int(os.getenv("MAX_CONNECTIONS", "3"))  # Reduced from 10 to 3
    if active_connections >= max_connections:
        print(f"⚠️ Connection limit reached ({active_connections}/{max_connections})")
        await ws.close(code=1013, reason=f"Server at capacity ({active_connections}/{max_connections} connections)")
        return
    
    # MEMORY OPTIMIZATION: Unload unused models if memory is tight
    model_unload_timeout = int(os.getenv("MODEL_UNLOAD_TIMEOUT", "600"))  # 10 minutes
    current_time = time.time()
    
    # Unload models that haven't been used recently
    for lang in list(models.keys()):
        if lang != language and lang in model_last_used:
            time_since_use = current_time - model_last_used.get(lang, 0)
            if time_since_use > model_unload_timeout:
                print(f"🗑️ Unloading unused {lang} model (idle for {int(time_since_use)}s)")
                del models[lang]
                model_last_used.pop(lang, None)
                gc.collect()  # Force garbage collection
    
    # Lazy load model if not already loaded
    if language not in models:
        print(f"⏳ Lazy loading {language} model from: {model_paths[language]}")
        print(f"📊 Active connections: {active_connections}/{max_connections}")
        try:
            models[language] = Model(model_paths[language])
            print(f"✓ {language.capitalize()} model loaded successfully")
            model_last_used[language] = time.time()
            gc.collect()  # Free up memory after loading
        except MemoryError as e:
            print(f"❌ Out of memory loading {language} model: {e}")
            # Try to free up memory by unloading other models
            for lang in list(models.keys()):
                if lang != language:
                    print(f"🗑️ Emergency unload of {lang} model to free memory")
                    del models[lang]
                    model_last_used.pop(lang, None)
            gc.collect()
            # Try loading again
            try:
                models[language] = Model(model_paths[language])
                print(f"✓ {language.capitalize()} model loaded after emergency cleanup")
                model_last_used[language] = time.time()
            except Exception as e2:
                print(f"❌ Still failed to load {language} model: {e2}")
                await ws.close(code=1011, reason=f"Failed to load {language} model: Out of memory")
                return
        except Exception as e:
            print(f"❌ Error loading {language} model: {e}")
            await ws.close(code=1011, reason=f"Failed to load {language} model")
            return
    
    model = models[language]
    await recognize(ws, path, model, language)

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
    
    # AGGRESSIVE MEMORY OPTIMIZATION: Very low connection limit
    max_connections = int(os.getenv("MAX_CONNECTIONS", "3"))  # Reduced from 10 to 3
    print(f"🔒 Maximum concurrent connections: {max_connections}")
    print(f"⏱️ Connection timeout: {os.getenv('CONNECTION_TIMEOUT', '300')}s")
    print(f"🗑️ Model unload timeout: {os.getenv('MODEL_UNLOAD_TIMEOUT', '600')}s")
    
    # Periodic memory cleanup task
    async def periodic_cleanup():
        """Periodically clean up memory and unload unused models"""
        while True:
            await asyncio.sleep(60)  # Run every minute
            current_time = time.time()
            model_unload_timeout = int(os.getenv("MODEL_UNLOAD_TIMEOUT", "600"))
            
            # Unload models that haven't been used
            for lang in list(models.keys()):
                if lang in model_last_used:
                    time_since_use = current_time - model_last_used[lang]
                    if time_since_use > model_unload_timeout:
                        print(f"🗑️ Periodic cleanup: Unloading unused {lang} model")
                        del models[lang]
                        model_last_used.pop(lang, None)
            
            # Clean up old connection timestamps
            expired_connections = [
                conn_id for conn_id, timestamp in connection_timestamps.items()
                if current_time - timestamp > 3600  # 1 hour
            ]
            for conn_id in expired_connections:
                connection_timestamps.pop(conn_id, None)
            
            # Force garbage collection
            gc.collect()
            
            # Log memory stats (if available)
            try:
                import psutil
                process = psutil.Process()
                mem_mb = process.memory_info().rss / 1024 / 1024
                print(f"📊 Memory usage: {mem_mb:.1f} MB | Active connections: {active_connections}/{max_connections} | Loaded models: {list(models.keys())}")
            except ImportError:
                # psutil not available, skip memory logging
                pass
    
    # Start periodic cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    async with websockets.serve(
        wrapped_handler, 
        "0.0.0.0", 
        args.port, 
        max_size=1024 * 1024,  # Limit message size to 1MB (was None)
        max_queue=max_connections,
        ping_interval=30,  # Increased from 20 to reduce overhead
        ping_timeout=10   # Reduced from 20 to close dead connections faster
    ):
        print(f"✅ Server started on port {args.port}")
        print(f"💡 Memory optimization: MAX_CONNECTIONS={max_connections}, LAZY_LOAD={args.lazy_load}")
        try:
            await asyncio.Future()  # run forever
        finally:
            cleanup_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())