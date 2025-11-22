# ⚠️ THIS FILE IS NO LONGER NEEDED

**Update**: We now use `Migueldrm/vosk-model-en-us-0.22-lgraph` which is already available!

The LGraph model is memory-efficient and works perfectly on Render's free tier (512 MB).

---

## ✅ Current Solution (Use This Instead)

Deploy with both languages using:
```
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```

See `START_HERE.md` for complete deployment instructions.

---

## Legacy Information (For Reference Only)

## Option 1: Quick Fix - Deploy Tagalog Only

Use the Tagalog-only configuration which already works:

**In Render Dashboard**:
```
Build Command: bash build.sh
Start Command: python server.py

Environment Variables:
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```

This will deploy successfully with ~200-250 MB RAM usage.

## Option 2: Upload Small English Model to Hugging Face

### Step 1: Download the Small English Model

Download from official Vosk website:
```bash
# Download small English model (40 MB)
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip

# Unzip it
unzip vosk-model-small-en-us-0.15.zip
```

### Step 2: Create Repository on Hugging Face

1. Go to https://huggingface.co/new
2. Create new model repository:
   - **Name**: `vosk-model-small-en-us-0.15`
   - **License**: Apache 2.0
   - **Visibility**: Public

### Step 3: Upload Model Files

**Using Web Interface**:
1. Go to your new repository
2. Click "Files and versions"
3. Click "Add file" → "Upload files"
4. Upload all files from `vosk-model-small-en-us-0.15/` directory

**Using Git (Alternative)**:
```bash
# Install git-lfs
git lfs install

# Clone your new repository
git clone https://huggingface.co/Migueldrm/vosk-model-small-en-us-0.15
cd vosk-model-small-en-us-0.15

# Copy model files
cp -r ../vosk-model-small-en-us-0.15/* .

# Add and commit
git add .
git commit -m "Add small English Vosk model"
git push
```

### Step 4: Update Configuration

Once uploaded, update the environment variable:
```
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-small-en-us-0.15
```

## Option 3: Use Alternative Small Model

If you don't want to upload, you can try using a direct download approach or use the full model with lazy loading (risky on free tier).

### Modify download script to use direct URL:

In `download_huggingface_model.py`, add support for direct downloads:

```python
# Instead of HuggingFace, download directly from Vosk
SMALL_EN_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
```

But this requires modifying the download script significantly.

## Recommended Approach for Free Tier

**Deploy TWO separate services**:

1. **Tagalog Service** (use `render-tagalog-only.yaml`)
   - RAM: ~250 MB ✅
   - Works immediately (model already on HuggingFace)
   
2. **English Service** (after uploading small model)
   - RAM: ~200 MB ✅
   - Requires uploading model to HuggingFace first

## Quick Deploy Command (Tagalog Only)

For immediate deployment, use these settings in Render:

```yaml
Build Command: bash build.sh
Start Command: python server.py

Environment Variables:
PORT=10000  # Render sets this automatically
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
VOSK_TAGALOG_MODEL_PATH=./model-tagalog
VOSK_ENGLISH_MODEL_PATH=./model-english
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
MAX_CONNECTIONS=5
USE_SMALL_MODELS=false
```

This will deploy successfully in 5-10 minutes!

## Summary

| Option | Time | Memory | Complexity |
|--------|------|--------|------------|
| **Tagalog Only** | 10 min | 250 MB | ✅ Easy |
| **Upload Small Model** | 1 hour | 200 MB | ⚠️ Medium |
| **Use Full English Model** | 10 min | 2 GB | ❌ Won't work on free tier |

**Recommendation**: Start with **Tagalog Only**, then upload small English model later when you have time.

