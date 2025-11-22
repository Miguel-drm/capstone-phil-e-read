# Render Deployment Guide for Vosk WebSocket Server

This guide shows you how to deploy the Vosk WebSocket server (supporting both Tagalog and English) to Render.

## 🚀 Quick Start

### Option 1: Using render.yaml (Recommended)

1. **Push your code to GitHub** (if not already):
   ```bash
   git add build.sh render.yaml
   git commit -m "Add Render deployment configuration"
   git push
   ```

2. **Create a new Web Service on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select the repository containing your VoskServer code

3. **Configure the service**:
   - **Name**: `phil-e-read-vosk-server` (or your preferred name)
   - **Root Directory**: `VoskServer` (if the server is in a subdirectory)
   - **Runtime**: Python 3
   - **Build Command**: `bash build.sh`
   - **Start Command**: `python server.py`
   - **Plan**: Free (for testing) or Starter (for production)

4. **Wait for deployment**:
   - The build process will take 5-10 minutes (downloading models)
   - Watch the logs to see progress

5. **Get your WebSocket URL**:
   - Once deployed, you'll see a URL like: `https://phil-e-read-vosk-server.onrender.com`
   - Your WebSocket URL will be: `wss://phil-e-read-vosk-server.onrender.com`

### Option 2: Manual Configuration

If you prefer manual setup:

1. Create a new Web Service on Render
2. Connect your repository
3. Set the following:

   **Build Command**:
   ```bash
   bash build.sh
   ```

   **Start Command**:
   ```bash
   python server.py
   ```

   **Environment Variables**:
   ```
   PYTHON_VERSION=3.11.0
   VOSK_TAGALOG_MODEL_PATH=./model-tagalog
   VOSK_ENGLISH_MODEL_PATH=./model-english
   HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
   HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22
   ```

## 🔧 Environment Variables Explained

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 2700 | Port to run server on (Render sets this automatically) |
| `VOSK_TAGALOG_MODEL_PATH` | `./model-tagalog` | Directory for Tagalog model |
| `VOSK_ENGLISH_MODEL_PATH` | `./model-english` | Directory for English model |
| `HUGGINGFACE_TAGALOG_MODEL_REPO` | `Migueldrm/vosk-model-tl-ph-generic-0.6` | Hugging Face repo for Tagalog model |
| `HUGGINGFACE_ENGLISH_MODEL_REPO` | `Migueldrm/vosk-model-en-us-0.22` | Hugging Face repo for English model |

## 📝 What Happens During Build

The `build.sh` script:

1. ✅ Upgrades pip
2. ✅ Installs Python dependencies (`vosk`, `websockets`, `huggingface_hub`)
3. ✅ Downloads Tagalog model (~100-200 MB)
4. ✅ Downloads English model (~40-50 MB)
5. ✅ Verifies models are valid

**Expected build time**: 5-10 minutes (mostly downloading models)

## 🔗 Using Your Deployed Server

Once deployed, your WebSocket server will be available at:

```
wss://your-service-name.onrender.com
```

### Connection URLs

**For Tagalog recognition**:
```
wss://your-service-name.onrender.com/?lang=tagalog
```

**For English recognition**:
```
wss://your-service-name.onrender.com/?lang=english
```

### Frontend Configuration

Update your frontend `.env` file:

```env
VITE_VOSK_WS_URL=wss://your-service-name.onrender.com
```

The language parameter (`?lang=tagalog` or `?lang=english`) is added automatically by your frontend code.

## 🐛 Troubleshooting

### ❌ "No models loaded" error

**Problem**: Models weren't downloaded during build

**Solution**: 
1. Check build logs for errors during model download
2. Verify `build.sh` is being executed
3. Ensure `huggingface_hub` is in `requirements.txt`

### ❌ "Application exited early"

**Problem**: Server can't start without models

**Solutions**:
1. Redeploy and watch build logs
2. Check that build command is `bash build.sh` (not just `pip install -r requirements.txt`)
3. Verify Hugging Face model repositories are accessible

### ⚠️ Slow initial response

**Problem**: Free tier instances sleep after inactivity

**Solutions**:
1. Upgrade to Starter plan or higher (no sleeping)
2. Implement a keep-alive ping from your frontend
3. First connection after sleep takes 30-60 seconds

### 🔍 Check Build Logs

In Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for:
   ```
   ✓ Tagalog model downloaded successfully
   ✓ English model downloaded successfully
   ✓ Build completed successfully!
   ```

### 🔍 Check Runtime Logs

Look for these on startup:
```
Loading Tagalog model from: ./model-tagalog
✓ Tagalog model loaded
Loading English model from: ./model-english
✓ English model loaded
Starting WebSocket server on port XXXX
```

## 📊 Resource Requirements

### Disk Space
- Tagalog model: ~150 MB
- English model: ~45 MB
- Python dependencies: ~50 MB
- **Total**: ~250 MB

### Memory
- **Minimum**: 512 MB (Free tier)
- **Recommended**: 1 GB+ (Starter tier)

### Free Tier Limitations
- ⚠️ **750 hours/month** (instance sleeps after 15 min inactivity)
- ⚠️ **Slow cold starts** (30-60 seconds to wake up)
- ✅ Good for testing and development

### Starter Tier ($7/month)
- ✅ **Always-on** (no sleeping)
- ✅ **Fast response times**
- ✅ **More memory** (better performance)
- ✅ Recommended for production

## 🔄 Updating Your Deployment

To update your server:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update server"
   git push
   ```
3. Render will automatically redeploy (if auto-deploy is enabled)

**Manual deployment**:
- Go to your service in Render dashboard
- Click "Manual Deploy" → "Deploy latest commit"

## 🎯 Testing Your Deployment

Use the provided test script:

```bash
python test_websocket.py wss://your-service-name.onrender.com
```

Or test in your frontend application by updating the WebSocket URL.

## 💡 Best Practices

1. ✅ **Use environment variables** for configuration
2. ✅ **Monitor logs** for errors and performance
3. ✅ **Test both languages** (Tagalog and English)
4. ✅ **Upgrade to paid tier** for production use
5. ✅ **Set up health checks** (Render can monitor uptime)

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Python Guide](https://render.com/docs/deploy-python)
- [Vosk Documentation](https://alphacephei.com/vosk/)

## 🆘 Need Help?

If you encounter issues:

1. Check the build logs in Render dashboard
2. Verify all environment variables are set correctly
3. Test locally first with `python server.py`
4. Check that your Hugging Face model repositories are public

---

**Ready to deploy?** Follow the Quick Start steps above! 🚀

