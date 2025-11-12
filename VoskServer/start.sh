#!/bin/bash
# Start script for Render deployment
# Downloads model from Hugging Face if needed, then starts the server

set -e

echo "Starting VoskServer on Render..."

# Download model from Hugging Face if not already present
echo "Checking for model..."
python download_huggingface_model.py

# Start the server
echo "Starting WebSocket server..."
python server.py --model ${VOSK_MODEL_PATH:-./model} --port ${PORT:-2700}

