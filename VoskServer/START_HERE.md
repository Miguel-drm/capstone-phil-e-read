# 🚀 START HERE - Render Deployment for Free Tier

## The Issue You Had ❌

The repository `alphacep/vosk-model-small-en-us-0.15` doesn't exist on Hugging Face.
That's why you got the "Repository Not Found" error.

## ✅ WORKING SOLUTION (Deploy Now!)

**Deploy Tagalog-only server** - This works immediately on free tier!

### Quick Deploy Steps:

#### 1. Go to Render Dashboard
https://dashboard.render.com/

#### 2. Create New Web Service
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository
- Select `Phil-E-Read` repository

#### 3. Configure Service

**Basic Settings**:
```
Name: phil-e-read-tagalog-vosk
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
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```

#### 4. Deploy
- Click **"Create Web Service"**
- Wait 5-10 minutes (watch logs)

#### 5. Success! 🎉

You should see in logs:
```
✓ Tagalog model downloaded successfully
✓ Build completed successfully!
✓ Tagalog model path registered
Starting WebSocket server on port 10000
```

Your WebSocket URL: `wss://phil-e-read-tagalog-vosk.onrender.com`

#### 6. Update Frontend

Create `frontend/.env`:
```env
VITE_VOSK_WS_URL=wss://phil-e-read-tagalog-vosk.onrender.com
```

**Expected RAM Usage**: ~200-250 MB ✅ Safe for free tier!

---

## 📊 What About English?

You have **3 options**:

### Option 1: Upload Small English Model (Best for Free Tier)
- Download: https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
- Upload to your Hugging Face account
- See: `UPLOAD_SMALL_ENGLISH_MODEL.md`
- **RAM**: ~200 MB ✅

### Option 2: Use Full English Model (Requires Paid Tier)
- Already on your HuggingFace: `Migueldrm/vosk-model-en-us-0.22`
- **RAM**: ~2 GB ❌ Needs Starter plan ($7/month)
- Better accuracy

### Option 3: Use Both (Separate Services)
- Deploy Tagalog service (free tier)
- Deploy English service (free tier with small model OR paid tier with full model)
- Most reliable approach

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

Deploy **Tagalog now**, use it for testing.
Later, when you have time, upload the small English model for English support.

**Total time**: 10 minutes to get Tagalog working! 🚀

