# Quick Start: Deploy to Render

## 🚀 Fast Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Render deployment configuration"
git push
```

### 2. Deploy on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your repository
5. Configure:
   - **Name**: `vosk-server`
   - **Root Directory**: `VoskServer` (if VoskServer is in a subdirectory)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `bash start.sh`
6. Click **"Create Web Service"**

### 3. Wait for Deployment

- First deployment takes 5-10 minutes (model download)
- Subsequent deployments are faster (model is cached)
- Check logs to see progress

### 4. Your WebSocket Server is Ready!

Your server will be available at:
```
wss://vosk-server.onrender.com
```

## 📋 What Happens Automatically

1. ✅ Dependencies installed (`vosk`, `websockets`, `huggingface_hub`)
2. ✅ Model downloaded from Hugging Face: `Migueldrm/vosk-model-tl-ph-generic-0.6`
3. ✅ WebSocket server started on Render's PORT

## 🔧 Environment Variables (Optional)

You can set these in Render dashboard → Environment:
- `VOSK_MODEL_PATH`: `./model` (default)
- `HUGGINGFACE_MODEL_REPO`: `Migueldrm/vosk-model-tl-ph-generic-0.6` (default)

## ⚠️ Important Notes

- **Free Tier**: Service spins down after 15 min inactivity (first request will be slow)
- **Starter Plan ($7/month)**: Always on, recommended for production
- **Model**: Automatically downloaded from your Hugging Face repo on first startup

## 🐛 Troubleshooting

**Service won't start?**
- Check Render logs
- Verify `start.sh` exists and is in VoskServer directory

**Model download fails?**
- Check Hugging Face repo is public: https://huggingface.co/Migueldrm/vosk-model-tl-ph-generic-0.6
- Verify model files are in the repo

**WebSocket connection fails?**
- Use `wss://` (secure WebSocket)
- Check service is running (not spun down)

## 📚 Full Documentation

See `README_RENDER.md` for detailed instructions.

