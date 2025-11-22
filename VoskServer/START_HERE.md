# 🚀 START HERE - Render Deployment for Free Tier

## The Issue You Had ❌

The repository `alphacep/vosk-model-small-en-us-0.15` doesn't exist on Hugging Face.
That's why you got the "Repository Not Found" error.

## ✅ WORKING SOLUTIONS (Choose One)

### Solution A: Both Languages (Recommended! 🌟)
Deploy one server with both Tagalog AND English using the LGraph model!

### Solution B: Tagalog-Only
Start with Tagalog, add English later

### Solution A: Both Languages (Quick Deploy)

#### 1. Go to Render Dashboard
https://dashboard.render.com/

#### 2. Create New Web Service
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository
- Select `Phil-E-Read` repository

#### 3. Configure Service

**Basic Settings**:
```
Name: phil-e-read-vosk-bilingual
Root Directory: VoskServer
Runtime: Python 3
Build Command: bash build.sh
Start Command: python server.py
Plan: Free
```

**Environment Variables** (Add each one):
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```

#### 4. Deploy
- Click **"Create Web Service"**
- Wait 10-15 minutes (downloading both models)

#### 5. Success! 🎉

You should see in logs:
```
✓ Tagalog model downloaded successfully
✓ English model downloaded successfully
✓ Build completed successfully!
✓ Tagalog model path registered
✓ English model path registered
🔧 Lazy loading enabled - models will be loaded on first use
Starting WebSocket server on port 10000
Available languages: ['tagalog', 'english']
```

Your WebSocket URL: `wss://phil-e-read-vosk-bilingual.onrender.com`

#### 6. Update Frontend

Create `frontend/.env`:
```env
VITE_VOSK_WS_URL=wss://phil-e-read-vosk-bilingual.onrender.com
```

**Expected RAM Usage**: 
- First Tagalog user: ~250 MB ✅
- First English user: ~350 MB ✅
- Both loaded: ~500 MB ✅ (with lazy loading, only one active at a time)

---

### Solution B: Tagalog-Only (If You Want to Start Simple)

Use the same steps but with these environment variables:
```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```

**RAM**: ~200-250 MB ✅ Very safe

---

## 📊 What About English?

**Good news!** English now works on free tier too! 🎉

We're using the **LGraph model** (`vosk-model-en-us-0.22-lgraph`) which is memory-efficient.

### Option 1: Deploy Both Languages (Single Service)
```
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
VOSK_LAZY_LOAD=true
```
- **RAM**: ~250-350 MB per model (lazy loaded) ✅
- Works on free tier!

### Option 2: Deploy English-Only Service
```
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```
- **RAM**: ~300-350 MB ✅
- Very safe for free tier

### Option 3: Separate Services (Most Reliable)
- Deploy Tagalog service (free tier)
- Deploy English service (free tier)
- Best isolation and reliability

---

## 🎯 Recommended Approach

**For now**: Deploy **Tagalog-only** (works immediately)

**Later**: 
1. Upload small English model to Hugging Face (1 hour)
2. Deploy English service
3. Update frontend to use both services

---

## 📚 Full Documentation

- **`RENDER_QUICK_SETUP.md`** - Step-by-step deployment
- **`UPLOAD_SMALL_ENGLISH_MODEL.md`** - How to upload English model
- **`MEMORY_OPTIMIZATION_GUIDE.md`** - Memory strategies explained
- **`RENDER_DEPLOYMENT_GUIDE.md`** - Complete deployment guide

---

## 🐛 Troubleshooting

### ❌ "Repository Not Found" for English
**Cause**: Small English model doesn't exist on HuggingFace
**Fix**: Use Tagalog-only OR upload small model yourself

### ❌ "Application exited early"
**Cause**: Out of memory
**Fix**: Use Tagalog-only on free tier

### ⚠️ Slow cold start (30-60 seconds)
**Cause**: Free tier instances sleep after 15 min
**Fix**: Normal behavior OR upgrade to paid tier

---

## ✅ Quick Checklist

- [ ] Push latest code to GitHub (already done ✓)
- [ ] Create Web Service on Render
- [ ] Set Build Command: `bash build.sh`
- [ ] Set Start Command: `python server.py`
- [ ] Add environment variables (Tagalog-only)
- [ ] Deploy and wait 5-10 minutes
- [ ] Get WebSocket URL
- [ ] Update `frontend/.env`
- [ ] Test in your app

---

## 💡 Pro Tip

**Recommended**: Deploy **both languages** using Solution A!

The LGraph English model is memory-efficient enough for free tier.
With lazy loading, only one model is in memory at a time.

**Total time**: 15 minutes to get both languages working! 🚀

**Alternative**: Start with Tagalog-only (Solution B) if you want the safest option.

