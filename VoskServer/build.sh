#!/usr/bin/env bash
# Build script for Render deployment
# This script runs during the build phase to download models

set -o errexit  # Exit on error

echo "================================="
echo "Installing dependencies..."
echo "================================="
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "================================="
echo "Downloading Vosk models..."
echo "================================="
python download_huggingface_model.py

echo ""
echo "================================="
echo "Build completed successfully!"
echo "================================="

