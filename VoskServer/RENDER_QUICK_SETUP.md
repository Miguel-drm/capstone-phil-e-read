# 🚀 Render Quick Setup - Memory Optimized for Free Tier (512 MB)

## ⚡ Fastest Way: English-Only Server (Most Reliable)

### Step 1: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your Phil-E-Read repository

### Step 2: Configure Service

**Basic Settings**:
- **Name**: `phil-e-read-english-vosk`
- **Root Directory**: `VoskServer`
- **Runtime**: Python 3
- **Build Command**: `bash build.sh`
- **Start Command**: `python server.py`
- **Plan**: Free

**Environment Variables** (Click "Add Environment Variable"):
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
HUGGINGFACE_ENGLISH_MODEL_REPO=alphacep/vosk-model-small-en-us-0.15
```

### Step 3: Deploy
- Click **"Create Web Service"**
- Wait 5-10 minutes for models to download
- ✅ Done!

### Step 4: Get Your WebSocket URL
Once deployed, you'll see: `https://phil-e-read-english-vosk.onrender.com`

Your WebSocket URL is: `wss://phil-e-read-english-vosk.onrender.com`

### Step 5: Update Frontend
Create `frontend/.env`:
```env
VITE_VOSK_WS_URL=wss://phil-e-read-english-vosk.onrender.com
```

---

## 🇵🇭 Tagalog-Only Server

Same as above, but use these environment variables:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```

---

## 🌍 Both Languages (Requires More Careful Setup)

**Environment Variables**:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
HUGGINGFACE_ENGLISH_MODEL_REPO=alphacep/vosk-model-small-en-us-0.15
```

⚠️ **Warning**: May hit 512 MB limit when both models are loaded. Consider deploying separate services instead.

---

## 📊 Expected Results

### Build Logs (Success)
```
✓ Tagalog model downloaded successfully
OR
✓ English model downloaded successfully
✓ Build completed successfully!
```

### Runtime Logs (Success)
```
✓ English model path registered: ./model-english
Starting WebSocket server on port 10000
🔧 Lazy loading enabled - models will be loaded on first use
Memory optimization: Enabled
```

---

## 🐛 Troubleshooting

### ❌ "No models loaded" error
**Fix**: Check that `bash build.sh` is set as Build Command (not just `pip install`)

### ❌ "Application exited early" / Crashes
**Fix**: You're out of memory. Use single-language deployment instead.

### ⚠️ Slow cold start (30-60 seconds)
**Fix**: Normal for free tier. Upgrade to Starter plan ($7/month) for always-on service.

---

## 💡 Recommended: Separate Services

**Best reliability on free tier**:

1. Deploy English-only service → `wss://your-english-server.onrender.com`
2. Deploy Tagalog-only service → `wss://your-tagalog-server.onrender.com`

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

