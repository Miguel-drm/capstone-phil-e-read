#!/usr/bin/env python3
"""
Download Vosk models from Hugging Face.
Downloads both Tagalog and English models.
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

# Model repositories
# For low-memory deployments (< 512MB RAM), use small models
USE_SMALL_MODELS = os.getenv("USE_SMALL_MODELS", "true").lower() == "true"

if USE_SMALL_MODELS:
    # Small models - optimized for low memory usage
    TAGALOG_MODEL_REPO = os.getenv("HUGGINGFACE_TAGALOG_MODEL_REPO", "Migueldrm/vosk-model-tl-ph-generic-0.6")
    ENGLISH_MODEL_REPO = os.getenv("HUGGINGFACE_ENGLISH_MODEL_REPO", "alphacep/vosk-model-small-en-us-0.15")
    print("🔧 Using small models for low-memory deployment")
else:
    # Full models - better accuracy but more memory
    TAGALOG_MODEL_REPO = os.getenv("HUGGINGFACE_TAGALOG_MODEL_REPO", "Migueldrm/vosk-model-tl-ph-generic-0.6")
    ENGLISH_MODEL_REPO = os.getenv("HUGGINGFACE_ENGLISH_MODEL_REPO", "Migueldrm/vosk-model-en-us-0.22")
    print("Using full models for better accuracy")

TAGALOG_MODEL_DIR = os.getenv("VOSK_TAGALOG_MODEL_PATH", "./model-tagalog")
ENGLISH_MODEL_DIR = os.getenv("VOSK_ENGLISH_MODEL_PATH", "./model-english")

# Download only specific models if specified
DOWNLOAD_TAGALOG = os.getenv("DOWNLOAD_TAGALOG", "true").lower() == "true"
DOWNLOAD_ENGLISH = os.getenv("DOWNLOAD_ENGLISH", "true").lower() == "true"

# Legacy support: if VOSK_MODEL_PATH is set, use it for Tagalog
if os.getenv("VOSK_MODEL_PATH") and not os.getenv("VOSK_TAGALOG_MODEL_PATH"):
    TAGALOG_MODEL_DIR = os.getenv("VOSK_MODEL_PATH", "./model-tagalog")

def verify_model_exists(model_dir):
    """Check if model is already present and valid."""
    model_path = Path(model_dir)
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

def download_model(repo_id, model_dir, model_name):
    """Download model from Hugging Face."""
    if verify_model_exists(model_dir):
        print(f"✓ {model_name} model already exists and appears valid at {model_dir}")
        return True
    
    print(f"Downloading {model_name} model from Hugging Face: {repo_id}")
    print(f"Target directory: {model_dir}")
    print("This may take several minutes for large models...")
    
    try:
        # Create model directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)
        
        # Download from Hugging Face
        # snapshot_download downloads all files from the repo
        # Note: resume_download and local_dir_use_symlinks are deprecated
        # Downloads automatically resume and don't use symlinks anymore
        downloaded_path = snapshot_download(
            repo_id=repo_id,
            local_dir=model_dir
        )
        
        print(f"✓ {model_name} model downloaded successfully to {model_dir}")
        
        # Verify the download
        if verify_model_exists(model_dir):
            print(f"✓ {model_name} model verification successful!")
            return True
        else:
            print(f"⚠ Warning: {model_name} model downloaded but verification failed.")
            print("  The model may still work, but some files might be missing.")
            return True  # Still return True as the download succeeded
            
    except Exception as e:
        print(f"✗ Error downloading {model_name} model: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Download Tagalog and/or English models based on configuration."""
    print("=" * 60)
    print("Vosk Model Downloader")
    print("=" * 60)
    print()
    
    tagalog_success = True
    english_success = True
    
    if DOWNLOAD_TAGALOG:
        tagalog_success = download_model(
            TAGALOG_MODEL_REPO,
            TAGALOG_MODEL_DIR,
            "Tagalog"
        )
        print()
    else:
        print("⏭️  Skipping Tagalog model download (DOWNLOAD_TAGALOG=false)")
        print()
    
    if DOWNLOAD_ENGLISH:
        english_success = download_model(
            ENGLISH_MODEL_REPO,
            ENGLISH_MODEL_DIR,
            "English"
        )
        print()
    else:
        print("⏭️  Skipping English model download (DOWNLOAD_ENGLISH=false)")
        print()
    
    print("=" * 60)
    downloaded_count = sum([DOWNLOAD_TAGALOG and tagalog_success, DOWNLOAD_ENGLISH and english_success])
    
    if downloaded_count >= 1:
        print(f"✓ Downloaded {downloaded_count} model(s) successfully!")
        return True
    elif not DOWNLOAD_TAGALOG and not DOWNLOAD_ENGLISH:
        print("⚠ No models configured for download.")
        print("  Set DOWNLOAD_TAGALOG=true or DOWNLOAD_ENGLISH=true")
        return False
    else:
        print("✗ Failed to download models.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

