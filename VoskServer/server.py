import argparse
import asyncio
import json
import os
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

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to Vosk model directory (root folder)")
    parser.add_argument("--port", type=int, default=2700)
    args = parser.parse_args()

    if not os.path.isdir(args.model):
        print("Model path does not exist:", args.model)
        return

    print("Loading model from:", args.model)
    model = Model(args.model)
    print("Model loaded. Starting WebSocket on port", args.port)

    async def handler(ws):
        # websockets v12+ passes only the websocket object to the handler
        await recognize(ws, "/", model)

    async with websockets.serve(handler, "0.0.0.0", args.port, max_size=None):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())