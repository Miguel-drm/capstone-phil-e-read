# Memory Optimization Guide for Vosk Server on Render Free Tier

This guide explains how to deploy the Vosk WebSocket server on Render's **free tier (512 MB RAM)** using various memory optimization techniques.

## 🎯 The Problem

Render's free tier provides **512 MB RAM**, but Vosk models can be memory-hungry:

- **Tagalog Model**: ~150 MB on disk, ~200-250 MB in RAM
- **English Full Model (0.22)**: ~1.8 GB on disk, ~2+ GB in RAM ❌ TOO LARGE
- **English Small Model (0.15)**: ~40 MB on disk, ~100-150 MB in RAM ✅ PERFECT

Loading both models at once = **350-400 MB baseline** + overhead = **OVER 512 MB** ❌

## ✅ The Solution: Memory Optimization Strategies

### Strategy 1: Use Small Models (Recommended)

**Before** (Won't fit in 512 MB):
```env
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22  # 1.8 GB
```

**After** (Fits in 512 MB):
```env
HUGGINGFACE_ENGLISH_MODEL_REPO=alphacep/vosk-model-small-en-us-0.15  # 40 MB
USE_SMALL_MODELS=true
```

### Strategy 2: Lazy Loading

**Before** (Loads all models at startup):
```python
# Both models loaded = 400+ MB RAM immediately
models["tagalog"] = Model("./model-tagalog")
models["english"] = Model("./model-english")
```

**After** (Loads models on first use):
```env
VOSK_LAZY_LOAD=true  # Models loaded only when needed
```

**Benefits**:
- Server starts with ~50 MB RAM
- First model loads when first client connects
- Second model loads only if requested

### Strategy 3: Deploy Separate Services (Best for Free Tier)

Instead of one server with both models, deploy **two separate services**:

#### Option A: Tagalog-Only Server
```bash
# Uses: render-tagalog-only.yaml
- RAM: ~200-250 MB ✅
- Models: Tagalog only
- URL: wss://your-tagalog-server.onrender.com
```

#### Option B: English-Only Server
```bash
# Uses: render-english-only.yaml
- RAM: ~150-200 MB ✅
- Models: English small model only
- URL: wss://your-english-server.onrender.com
```

This is the **most reliable** approach for the free tier!

### Strategy 4: Limit Concurrent Connections

```env
MAX_CONNECTIONS=5  # Prevent memory spikes from too many users
```

Each active connection uses ~10-20 MB RAM. Limiting to 5 connections = safer for free tier.

## 🚀 Deployment Options

### Option 1: Dual-Language Server (Optimized)

**Best for**: Testing both languages, paid tier recommended

**Configuration**: `render.yaml`

```yaml
# Memory optimized for 512 MB
VOSK_LAZY_LOAD=true
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=true
```

**Expected RAM**:
- Startup: ~50 MB
- With Tagalog loaded: ~250 MB
- With both loaded: ~400 MB (tight but possible)

**Deploy**:
```bash
# In Render dashboard, set:
Build Command: bash build.sh
Start Command: python server.py
```

### Option 2: Tagalog-Only Server (Safest for Free Tier)

**Best for**: Filipino reading app, reliable free tier

**Configuration**: `render-tagalog-only.yaml`

```yaml
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false  # Don't download English model
```

**Expected RAM**: ~200-250 MB ✅ Safe margin

**Deploy**:
```bash
# In Render dashboard:
# Use render-tagalog-only.yaml configuration
# OR manually set environment variables
```

### Option 3: English-Only Server (Safest for Free Tier)

**Best for**: English reading app, reliable free tier

**Configuration**: `render-english-only.yaml`

```yaml
VOSK_LAZY_LOAD=true
DOWNLOAD_ENGLISH=true
DOWNLOAD_TAGALOG=false  # Don't download Tagalog model
USE_SMALL_MODELS=true  # Use small English model
```

**Expected RAM**: ~150-200 MB ✅ Very safe

**Deploy**:
```bash
# In Render dashboard:
# Use render-english-only.yaml configuration
```

### Option 4: Separate Services (Most Reliable)

**Best for**: Production app, maximum reliability

Deploy **both** tagalog-only and english-only servers separately.

**Frontend Configuration**:
```typescript
// Dynamically select WebSocket URL based on story language
const wsUrl = storyLanguage === 'tagalog' 
  ? 'wss://phil-e-read-tagalog.onrender.com'
  : 'wss://phil-e-read-english.onrender.com';
```

**Benefits**:
- ✅ Each service uses <250 MB RAM
- ✅ No risk of OOM (Out of Memory)
- ✅ Better isolation and reliability
- ✅ Can scale independently

**Drawback**:
- ❌ Uses 2 free tier slots (or pay for one)

## 📊 Memory Comparison

| Configuration | Startup RAM | Peak RAM | Free Tier? | Reliability |
|---------------|-------------|----------|------------|-------------|
| Dual-language (old) | 400 MB | 500+ MB | ❌ Risky | Low |
| Dual-language (optimized) | 50 MB | 400 MB | ⚠️ Tight | Medium |
| Tagalog-only | 50 MB | 250 MB | ✅ Safe | High |
| English-only | 50 MB | 200 MB | ✅ Very Safe | High |
| Separate services | 50 MB each | 250 MB each | ✅ Best | Very High |

## 🔧 Environment Variables Reference

### Memory Optimization

| Variable | Default | Description |
|----------|---------|-------------|
| `VOSK_LAZY_LOAD` | `true` | Load models on-demand (not at startup) |
| `USE_SMALL_MODELS` | `true` | Use smaller models for English |
| `MAX_CONNECTIONS` | `5` | Limit concurrent WebSocket connections |

### Model Selection

| Variable | Default | Description |
|----------|---------|-------------|
| `DOWNLOAD_TAGALOG` | `true` | Download Tagalog model during build |
| `DOWNLOAD_ENGLISH` | `true` | Download English model during build |

### Model Repositories

| Variable | Default (Small) | Default (Full) |
|----------|----------------|----------------|
| `HUGGINGFACE_TAGALOG_MODEL_REPO` | `Migueldrm/vosk-model-tl-ph-generic-0.6` | Same |
| `HUGGINGFACE_ENGLISH_MODEL_REPO` | `alphacep/vosk-model-small-en-us-0.15` | `Migueldrm/vosk-model-en-us-0.22` |

## 🐛 Troubleshooting

### ❌ "Application exited early" / OOM (Out of Memory)

**Symptoms**:
- Server crashes shortly after startup
- "Killed" in logs
- Random disconnections

**Solutions**:
1. ✅ Enable lazy loading: `VOSK_LAZY_LOAD=true`
2. ✅ Use small models: `USE_SMALL_MODELS=true`
3. ✅ Deploy separate services for each language
4. ✅ Upgrade to Starter plan ($7/month, 512MB → 2GB RAM)

### ⚠️ Slow first connection

**Symptoms**:
- First user waits 5-10 seconds for response
- Subsequent users are fast

**Cause**: Lazy loading - model loads on first use

**Solutions**:
- ✅ This is normal and saves memory!
- ✅ Add loading indicator in frontend
- ℹ️ After first load, model stays in memory

### 📊 Monitor Memory Usage

Check Render logs for memory stats:
```
Starting WebSocket server on port 10000
Memory optimization: Enabled
⏳ Lazy loading english model...
✓ English model loaded successfully
```

## 💡 Recommendations

### For Development/Testing
- ✅ Use dual-language optimized (render.yaml)
- ✅ Accept some memory constraints
- ✅ Test both languages

### For Production (Small Scale)
- ✅ Deploy separate Tagalog and English services
- ✅ Most reliable on free tier
- ✅ Better monitoring and debugging

### For Production (Medium Scale)
- ✅ Upgrade to Starter plan ($7/month)
- ✅ Use dual-language server
- ✅ Turn off lazy loading for faster response
- ✅ Increase MAX_CONNECTIONS to 20+

### For Production (Large Scale)
- ✅ Use Professional plan ($25/month, 4GB RAM)
- ✅ Load full models for better accuracy
- ✅ Set USE_SMALL_MODELS=false
- ✅ Higher concurrency

## 📝 Quick Start Commands

### Deploy Dual-Language (Optimized)
```bash
git add VoskServer/
git commit -m "Add memory-optimized Vosk server"
git push

# In Render: use render.yaml configuration
```

### Deploy Tagalog-Only
```bash
# In Render dashboard:
# Build Command: bash build.sh
# Start Command: python server.py
# Environment:
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
```

### Deploy English-Only
```bash
# In Render dashboard:
# Build Command: bash build.sh
# Start Command: python server.py
# Environment:
VOSK_LAZY_LOAD=true
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
USE_SMALL_MODELS=true
MAX_CONNECTIONS=5
HUGGINGFACE_ENGLISH_MODEL_REPO=alphacep/vosk-model-small-en-us-0.15
```

## 🎯 Final Recommendation

**For Render Free Tier**: Deploy **separate services** (Option 4)
- Most reliable
- Lowest memory usage
- Best user experience

**For Paid Tier**: Use **dual-language optimized** server (Option 1)
- Simpler deployment
- Single endpoint
- Better performance

---

**Need help?** Check logs for memory-related errors and adjust configuration accordingly! 🚀

