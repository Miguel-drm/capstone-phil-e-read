#!/bin/bash
# Start script for cloud deployment
# Downloads models from Hugging Face if needed, then starts the server

set -e

echo "Starting VoskServer..."

# Download models from Hugging Face if not already present
echo "Checking for models..."
python download_huggingface_model.py

# Determine service language from environment variable
SERVICE_LANGUAGE=${SERVICE_LANGUAGE:-""}

# Start the server
echo "Starting WebSocket server..."
if [ -n "$SERVICE_LANGUAGE" ]; then
  echo "🔧 Service language set to: $SERVICE_LANGUAGE (loading only that model)"
  python server.py \
    --tagalog-model ${VOSK_TAGALOG_MODEL_PATH:-${VOSK_MODEL_PATH:-./model-tagalog}} \
    --english-model ${VOSK_ENGLISH_MODEL_PATH:-./model-english} \
    --port ${PORT:-2700} \
    --service-language ${SERVICE_LANGUAGE}
else
  echo "🔧 No SERVICE_LANGUAGE set - loading both models (if available)"
  python server.py \
    --tagalog-model ${VOSK_TAGALOG_MODEL_PATH:-${VOSK_MODEL_PATH:-./model-tagalog}} \
    --english-model ${VOSK_ENGLISH_MODEL_PATH:-./model-english} \
    --port ${PORT:-2700}
fi

