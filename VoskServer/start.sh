#!/bin/bash
# Start script for cloud deployment
# Downloads models from Hugging Face if needed, then starts the server

set -e

echo "Starting VoskServer..."

# Download models from Hugging Face if not already present
echo "Checking for models..."
python download_huggingface_model.py

# Start the server with both models
echo "Starting WebSocket server..."
python server.py \
  --tagalog-model ${VOSK_TAGALOG_MODEL_PATH:-${VOSK_MODEL_PATH:-./model-tagalog}} \
  --english-model ${VOSK_ENGLISH_MODEL_PATH:-./model-english} \
  --port ${PORT:-2700}

