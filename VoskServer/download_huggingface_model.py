#!/usr/bin/env python3
"""
Download Vosk model from Hugging Face.
This script downloads the model from: https://huggingface.co/Migueldrm/vosk-model-tl-ph-generic-0.6
"""
import os
import sys
from pathlib import Path

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("ERROR: huggingface_hub not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
    from huggingface_hub import snapshot_download

MODEL_REPO = os.getenv("HUGGINGFACE_MODEL_REPO", "Migueldrm/vosk-model-tl-ph-generic-0.6")
MODEL_DIR = os.getenv("VOSK_MODEL_PATH", "./model")

def verify_model_exists():
    """Check if model is already present and valid."""
    model_path = Path(MODEL_DIR)
    if not model_path.is_dir():
        return False
    
    # Check for key model files
    required_files = [
        model_path / "am" / "final.mdl",
        model_path / "graph" / "HCLG.fst"
    ]
    
    for file_path in required_files:
        if not file_path.exists():
            return False
    
    return True

def download_model():
    """Download model from Hugging Face."""
    if verify_model_exists():
        print(f"✓ Model already exists and appears valid at {MODEL_DIR}")
        return True
    
    print(f"Downloading model from Hugging Face: {MODEL_REPO}")
    print(f"Target directory: {MODEL_DIR}")
    print("This may take several minutes for large models...")
    
    try:
        # Create model directory if it doesn't exist
        os.makedirs(MODEL_DIR, exist_ok=True)
        
        # Download from Hugging Face
        # snapshot_download downloads all files from the repo
        downloaded_path = snapshot_download(
            repo_id=MODEL_REPO,
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False,  # Use actual files, not symlinks
            resume_download=True  # Resume if interrupted
        )
        
        print(f"✓ Model downloaded successfully to {MODEL_DIR}")
        
        # Verify the download
        if verify_model_exists():
            print("✓ Model verification successful!")
            return True
        else:
            print("⚠ Warning: Model downloaded but verification failed.")
            print("  The model may still work, but some files might be missing.")
            return True  # Still return True as the download succeeded
            
    except Exception as e:
        print(f"✗ Error downloading model: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = download_model()
    sys.exit(0 if success else 1)

