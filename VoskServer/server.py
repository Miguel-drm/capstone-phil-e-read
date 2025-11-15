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
    recognizer = KaldiRecognizer(model, sample_rate)
    try:
        async for message in websocket:
            # message is bytes (PCM16 LE)
            if isinstance(message, (bytes, bytearray)):
                if recognizer.AcceptWaveform(message):
                    res = json.loads(recognizer.Result())
                    await websocket.send(json.dumps({"text": res.get("text", "")}))
                else:
                    pres = json.loads(recognizer.PartialResult())
                    if pres.get("partial"):
                        await websocket.send(json.dumps({"partial": pres["partial"]}))
            else:
                # ignore non-binary messages
                pass
    finally:
        # send final result on close
        try:
            fres = json.loads(recognizer.FinalResult())
            await websocket.send(json.dumps({"text": fres.get("text", "")}))
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
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "2700")))
    args = parser.parse_args()

    global models
    models = {}
    
    # Load Tagalog model
    if os.path.isdir(args.tagalog_model):
        print("Loading Tagalog model from:", args.tagalog_model)
        models["tagalog"] = Model(args.tagalog_model)
        print("✓ Tagalog model loaded")
    else:
        print("⚠ Warning: Tagalog model path does not exist:", args.tagalog_model)
        print("  Tagalog recognition will not be available")
    
    # Load English model
    if os.path.isdir(args.english_model):
        print("Loading English model from:", args.english_model)
        models["english"] = Model(args.english_model)
        print("✓ English model loaded")
    else:
        print("⚠ Warning: English model path does not exist:", args.english_model)
        print("  English recognition will not be available")
    
    if not models:
        print("❌ Error: No models loaded. Please ensure at least one model directory exists.")
        return
    
    print(f"Starting WebSocket server on port {args.port}")
    print("Supported languages:", list(models.keys()))
    print("Usage: ws://host:port/?lang=tagalog or ws://host:port/?lang=english")

    # Create a wrapper to handle both old and new websockets API
    async def wrapped_handler(ws, path=None):
        # In websockets v12+, path is None and we get it from ws.path
        if path is None:
            path = getattr(ws, 'path', '/')
        return await handler(ws, path)
    
    async with websockets.serve(wrapped_handler, "0.0.0.0", args.port, max_size=None):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())