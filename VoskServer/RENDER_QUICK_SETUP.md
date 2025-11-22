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

## 🇺🇸 English-Only Server (Works on Free Tier!)

**Good news!** The LGraph English model works on free tier (512 MB).

**Environment Variables**:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```

**Expected RAM**: ~300-350 MB ✅ Fits in free tier!

---

## 🌍 Both Languages (Possible with Lazy Loading!)

With lazy loading + LGraph model, both languages can work on free tier!

**Environment Variables**:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```

**Expected RAM**: 
- With lazy loading: One model loaded at a time (~250-350 MB) ✅
- Both loaded: ~500-550 MB ⚠️ Tight but possible

**Recommendation**: Deploy separate services for better reliability, or upgrade to Starter plan for guaranteed performance.

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
**Fix**: Make sure you're using `Migueldrm/vosk-model-en-us-0.22-lgraph` (with -lgraph suffix)

### ⚠️ Slow cold start (30-60 seconds)
**Fix**: Normal for free tier. Upgrade to Starter plan ($7/month) for always-on service.

---

## 💡 Recommended: Separate Services

**Option 1: Single Service (Both Languages)**:
- Use lazy loading + LGraph model
- Both languages work on free tier! ✅
- One model loads at a time (~250-350 MB)

**Option 2: Separate Services (Best Reliability)**:
1. Deploy Tagalog-only service → `wss://your-tagalog-server.onrender.com`
2. Deploy English-only service → `wss://your-english-server.onrender.com`

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

