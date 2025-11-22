# 🚀 DEPLOY NOW - Both Languages on Free Tier!

## 🎉 Good News!

Using `Migueldrm/vosk-model-en-us-0.22-lgraph`, you can now deploy **BOTH Tagalog AND English** on Render's free tier (512 MB RAM)!

## ⚡ Quick Deploy (15 Minutes)

### Step 1: Go to Render
https://dashboard.render.com/

### Step 2: Create Web Service
- Click **"New +"** → **"Web Service"**
- Connect GitHub → Select `Phil-E-Read` repo

### Step 3: Configure

**Basic Settings**:
```
Name: phil-e-read-vosk-bilingual
Root Directory: VoskServer
Runtime: Python 3
Build Command: bash build.sh
Start Command: python server.py
Plan: Free
```

### Step 4: Add Environment Variables

Click "Add Environment Variable" and add each:

```
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=false
MAX_CONNECTIONS=5
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```

### Step 5: Deploy!
Click **"Create Web Service"** and wait 10-15 minutes

### Step 6: Watch Build Logs
You should see:
```
✓ Tagalog model downloaded successfully
✓ English model downloaded successfully
✓ Build completed successfully!
```

### Step 7: Get WebSocket URL
After deployment: `wss://phil-e-read-vosk-bilingual.onrender.com`

### Step 8: Update Frontend
Create `frontend/.env`:
```env
VITE_VOSK_WS_URL=wss://phil-e-read-vosk-bilingual.onrender.com
```

## 📊 Memory Usage

| Scenario | RAM Usage | Free Tier? |
|----------|-----------|------------|
| Server startup | ~50 MB | ✅ |
| First Tagalog user | ~250 MB | ✅ |
| First English user | ~350 MB | ✅ |
| Both models loaded | ~500 MB | ✅ |

With lazy loading, models load on first use!

## 🎯 How It Works

1. **Lazy Loading**: Models don't load at startup
2. **First Tagalog story**: Tagalog model loads (~250 MB)
3. **First English story**: English model loads (~350 MB)
4. **LGraph Model**: Memory-efficient English model (not the full 2GB version)

## ✅ What You Get

- ✅ **Tagalog recognition** via `?lang=tagalog`
- ✅ **English recognition** via `?lang=english`
- ✅ **Free tier compatible** (512 MB)
- ✅ **Good accuracy** (LGraph model)
- ✅ **Auto language detection** by your app

## 🔧 Why This Works

The **LGraph model** (`vosk-model-en-us-0.22-lgraph`) uses a lookahead graph instead of a regular graph, which:
- ✅ Reduces memory usage significantly
- ✅ Maintains good accuracy
- ✅ Loads faster
- ✅ Perfect for free tier deployment

## 🐛 Troubleshooting

### Build fails with "Repository Not Found"
**Check**: Make sure you're using `Migueldrm/vosk-model-en-us-0.22-lgraph` (note the `-lgraph` suffix)

### Application crashes / "exited early"
**Possible causes**:
1. Models aren't downloading (check build logs)
2. Missing environment variables
3. Wrong model repository names

**Fix**: Redeploy with "Clear build cache & deploy"

### Slow first connection
**Normal!** Free tier instances sleep after 15 minutes of inactivity.
- First wake-up: 30-60 seconds
- After that: Fast!

## 💡 Pro Tips

1. ✅ **Test immediately**: First Tagalog connection takes 5-10 seconds (loading model)
2. ✅ **Monitor logs**: Check "Logs" tab in Render dashboard
3. ✅ **Keep-alive**: Consider pinging your service every 10 minutes to prevent sleep
4. ✅ **Upgrade later**: If you need faster response, upgrade to Starter ($7/month)

## 🎊 You're All Set!

Your app now has:
- 🇵🇭 Tagalog speech recognition
- 🇺🇸 English speech recognition  
- 💰 Running on free tier
- 🚀 Ready for students to use

**Total cost**: $0/month! 🎉

---

## 📚 More Help

- **START_HERE.md** - Complete setup guide
- **RENDER_QUICK_SETUP.md** - Step-by-step deployment
- **MEMORY_OPTIMIZATION_GUIDE.md** - Memory strategies

**Ready?** Follow the steps above and deploy! 🚀

