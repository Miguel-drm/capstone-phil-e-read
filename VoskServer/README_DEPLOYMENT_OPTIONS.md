# Deployment Options for VoskServer (1GB+ RAM Required)

Your 775MB Vosk model requires at least **1GB RAM** to run. Here are the best deployment options:

## 🚀 Recommended Options

### Option 1: Fly.io (BEST FREE OPTION) ⭐

**Free Tier**: 3GB RAM, 3GB storage, 160GB bandwidth/month
**Cost**: FREE (with generous limits)

#### Why Fly.io?
- ✅ **3GB RAM free** - More than enough for your model
- ✅ **Always-on option** available
- ✅ **WebSocket support** built-in
- ✅ **Global edge network**
- ✅ **Free tier is very generous**

#### Deployment Steps:

1. **Install Fly.io CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Or download from: https://fly.io/docs/hands-on/install-flyctl/
   ```

2. **Login to Fly.io**
   ```bash
   fly auth login
   ```

3. **Deploy**
   ```bash
   cd VoskServer
   fly launch
   ```
   - Follow prompts (use existing `fly.toml`)
   - Select region closest to you
   - When asked about scaling, choose "1" machine

4. **Set Memory (if needed)**
   ```bash
   fly scale memory 1024
   ```

5. **Your server will be at**: `https://vosk-server.fly.dev`

#### Configuration:
- Already configured in `fly.toml`
- Memory set to 1GB (can increase if needed)
- Auto-start/stop enabled (free tier)

---

### Option 2: Railway (Good Free Option)

**Free Tier**: $5 credit/month (enough for small deployments)
**Starter Plan**: $5/month for 512MB RAM
**Developer Plan**: $20/month for 8GB RAM

#### Why Railway?
- ✅ **Easy deployment** from GitHub
- ✅ **$5 free credit** monthly
- ✅ **Developer plan** has 8GB RAM ($20/month)
- ✅ **Simple configuration**

#### Deployment Steps:

1. **Go to Railway**
   - Visit https://railway.app
   - Sign up/login with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Service**
   - Root Directory: `VoskServer`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `bash start.sh`

4. **Upgrade Plan** (Required for 1GB+)
   - Go to Settings → Plan
   - Select "Developer" plan ($20/month) for 8GB RAM
   - Or use free $5 credit to test

5. **Set Environment Variables** (Optional)
   - `VOSK_MODEL_PATH`: `./model`
   - `HUGGINGFACE_MODEL_REPO`: `Migueldrm/vosk-model-tl-ph-generic-0.6`

---

### Option 3: Render Standard Plan

**Cost**: $25/month
**RAM**: 2GB

#### Why Render Standard?
- ✅ **2GB RAM** - Sufficient for your model
- ✅ **Always on**
- ✅ **Easy to use** (you're already familiar)

#### To Upgrade on Render:

1. Go to your Render service
2. Click "Settings" → "Change Plan"
3. Select **"Standard"** plan ($25/month, 2GB RAM)
4. Redeploy

---

### Option 4: DigitalOcean App Platform

**Cost**: $12/month (Basic plan)
**RAM**: 1GB

#### Why DigitalOcean?
- ✅ **1GB RAM** at affordable price
- ✅ **Reliable infrastructure**
- ✅ **Good documentation**

#### Deployment Steps:

1. **Create App Platform App**
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect GitHub repository

2. **Configure**
   - **Source**: GitHub repo, `VoskServer` directory
   - **Build Command**: `pip install -r requirements.txt`
   - **Run Command**: `bash start.sh`
   - **Plan**: Basic ($12/month, 1GB RAM)

3. **Environment Variables**
   - `VOSK_MODEL_PATH`: `./model`
   - `HUGGINGFACE_MODEL_REPO`: `Migueldrm/vosk-model-tl-ph-generic-0.6`
   - `PORT`: (auto-set)

---

## 📊 Comparison Table

| Platform | Free Tier RAM | Paid Plan | Cost | Best For |
|----------|--------------|-----------|------|----------|
| **Fly.io** | 3GB | N/A | **FREE** | ⭐ Best free option |
| **Railway** | $5 credit | 8GB | $20/mo | Easy deployment |
| **Render** | 512MB | 2GB | $25/mo | Already set up |
| **DigitalOcean** | None | 1GB | $12/mo | Budget option |

## 🎯 Recommendation

**For Free**: Use **Fly.io** - 3GB RAM free, perfect for your needs!

**For Paid**: 
- **Budget**: DigitalOcean ($12/month, 1GB)
- **Best Value**: Railway Developer ($20/month, 8GB)
- **Already on Render**: Upgrade to Standard ($25/month, 2GB)

## 🚀 Quick Start: Fly.io (Recommended)

```bash
# 1. Install Fly CLI
# Windows: iwr https://fly.io/install.ps1 -useb | iex

# 2. Login
fly auth login

# 3. Deploy
cd VoskServer
fly launch

# 4. Your server: https://vosk-server.fly.dev
```

## 📝 Files Included

- `fly.toml` - Fly.io configuration (1GB RAM)
- `railway.json` - Railway configuration
- `Dockerfile` - Docker image (works with any platform)
- `start.sh` - Startup script (downloads model, starts server)

All platforms use the same code - just different configuration files!

