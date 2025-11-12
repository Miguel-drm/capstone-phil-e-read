# Quick Start: Deploy to Fly.io (FREE - 3GB RAM!)

Fly.io offers **3GB RAM for FREE** - perfect for your 775MB model! 🎉

## 🚀 5-Minute Deployment

### Step 1: Install Fly.io CLI

**Windows (PowerShell as Administrator):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Or download manually:**
- Visit: https://fly.io/docs/hands-on/install-flyctl/
- Download the Windows installer

### Step 2: Login

```bash
fly auth login
```
This will open your browser to sign up/login.

### Step 3: Deploy

```bash
cd VoskServer
fly launch
```

**When prompted:**
- App name: `vosk-server` (or your choice)
- Region: Choose closest to you (e.g., `iad` for US East)
- Use existing `fly.toml`? **Yes**
- Overwrite? **No** (keep our config)

### Step 4: Wait for Deployment

- First deployment takes 5-10 minutes (model download)
- You'll see build logs in terminal
- Look for: "Model downloaded successfully"

### Step 5: Your Server is Live! 🎉

Your WebSocket server will be at:
```
wss://vosk-server.fly.dev
```

(Replace `vosk-server` with your app name)

## ✅ Verify It Works

Check logs:
```bash
fly logs
```

You should see:
```
✓ Model downloaded successfully to ./model
✓ Model verification successful!
Starting WebSocket server...
Model loaded. Starting WebSocket on port 2700
```

## 🔧 Useful Commands

```bash
# View logs
fly logs

# Check status
fly status

# SSH into your app
fly ssh console

# Scale memory (if needed)
fly scale memory 1024

# Restart
fly apps restart vosk-server
```

## 💰 Cost

**FREE!** Fly.io free tier includes:
- ✅ 3GB RAM (more than enough!)
- ✅ 3GB storage
- ✅ 160GB bandwidth/month
- ✅ WebSocket support

## 🐛 Troubleshooting

**Deployment fails?**
```bash
fly logs
```
Check for errors in the logs.

**Model download fails?**
- Verify Hugging Face repo is accessible
- Check internet connectivity in logs

**Out of memory?**
```bash
fly scale memory 2048  # Increase to 2GB if needed
```

**WebSocket not working?**
- Ensure you're using `wss://` (secure WebSocket)
- Check that service is running: `fly status`

## 📚 Next Steps

- Your server is now live at `wss://your-app.fly.dev`
- Connect from your frontend using this URL
- Model is cached, so redeployments are fast

## 🎯 Why Fly.io?

- ✅ **3GB RAM FREE** (vs 512MB on Render free tier)
- ✅ **Always-on option** available
- ✅ **Global edge network** for low latency
- ✅ **WebSocket support** built-in
- ✅ **Easy scaling** if needed

Perfect for your 775MB model! 🚀

