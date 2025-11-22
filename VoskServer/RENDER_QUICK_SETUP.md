# 🚀 Render Quick Setup - Memory Optimized for Free Tier (512 MB)

## ⚡ Fastest Way: Tagalog-Only Server (Most Reliable - Works Immediately!)

### Step 1: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your Phil-E-Read repository

### Step 2: Configure Service

**Basic Settings**:
- **Name**: `phil-e-read-tagalog-vosk`
- **Root Directory**: `VoskServer`
- **Runtime**: Python 3
- **Build Command**: `bash build.sh`
- **Start Command**: `python server.py`
- **Plan**: Free

**Environment Variables** (Click "Add Environment Variable"):
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```

### Step 3: Deploy
- Click **"Create Web Service"**
- Wait 5-10 minutes for model to download
- ✅ Done!

### Step 4: Get Your WebSocket URL
Once deployed, you'll see: `https://phil-e-read-tagalog-vosk.onrender.com`

Your WebSocket URL is: `wss://phil-e-read-tagalog-vosk.onrender.com`

### Step 5: Update Frontend
Create `frontend/.env`:
```env
VITE_VOSK_WS_URL=wss://phil-e-read-tagalog-vosk.onrender.com
```

---

## 🇺🇸 English-Only Server (Requires Setup First)

**Note**: The small English model needs to be uploaded to Hugging Face first.
See `UPLOAD_SMALL_ENGLISH_MODEL.md` for instructions.

**After uploading the model**, use these environment variables:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-small-en-us-0.15
```

**OR use the full English model** (requires paid tier - 2GB RAM):
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=10
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22
```

---

## 🌍 Both Languages (Requires Paid Tier)

⚠️ **Warning**: Both models together exceed 512 MB free tier limit.

**Option 1**: Deploy separate Tagalog and English services (recommended)

**Option 2**: Use Render Starter plan ($7/month) with these variables:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=10
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22
```

---

## 📊 Expected Results

### Build Logs (Success)
```
✓ Tagalog model downloaded successfully to ./model-tagalog
OR
✓ English model downloaded successfully to ./model-english
✓ Build completed successfully!
```

### Runtime Logs (Success)
```
✓ Tagalog model path registered: ./model-tagalog
Starting WebSocket server on port 10000
🔧 Lazy loading enabled - models will be loaded on first use
Memory optimization: Enabled
Available languages: ['tagalog']
```

---

## 🐛 Troubleshooting

### ❌ "No models loaded" error
**Fix**: Check that `bash build.sh` is set as Build Command (not just `pip install`)

### ❌ "Application exited early" / Crashes
**Fix**: You're out of memory. Use Tagalog-only deployment on free tier.

### ❌ "Repository Not Found" for English model
**Fix**: Small English model not on Hugging Face yet. See `UPLOAD_SMALL_ENGLISH_MODEL.md` or use Tagalog-only for now.

### ⚠️ Slow cold start (30-60 seconds)
**Fix**: Normal for free tier. Upgrade to Starter plan ($7/month) for always-on service.

---

## 💡 Recommended: Separate Services

**Best reliability on free tier**:

1. Deploy Tagalog-only service → `wss://your-tagalog-server.onrender.com` ✅ Works now
2. Later: Upload small English model and deploy English service

**If you need both languages now**:
- Option A: Upload small English model to Hugging Face (see `UPLOAD_SMALL_ENGLISH_MODEL.md`)
- Option B: Upgrade to Render Starter plan ($7/month) and use full models

Update frontend to select URL based on story language:
```typescript
const wsUrl = storyLanguage === 'tagalog' 
  ? 'wss://your-tagalog-server.onrender.com'
  : 'wss://your-english-server.onrender.com';
```

**Benefits**:
- ✅ Each service <250 MB RAM (safe!)
- ✅ No crashes
- ✅ Better performance

---

## 📚 More Details

See `MEMORY_OPTIMIZATION_GUIDE.md` for complete explanation of all strategies.

