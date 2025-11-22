# Railway Deployment Guide for Separate Services

This guide explains how to deploy separate Tagalog and English Vosk services on Railway to avoid memory issues.

## Problem

Loading both models in a single service uses ~400-450MB RAM, which exceeds Railway's free tier limit (512MB) and causes crashes.

## Solution: Separate Services

Deploy **two separate services**, each loading only one model:
- **Tagalog service**: Only loads Tagalog model (~200-250MB RAM)
- **English service**: Only loads English model (~200-250MB RAM)

## Railway Service Configuration

### Tagalog Service (`vigilant-celebration`)

**Environment Variables:**
```
SERVICE_LANGUAGE=tagalog
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
VOSK_TAGALOG_MODEL_PATH=./model-tagalog
PORT=2700
```

**Start Command:**
```bash
bash start.sh
```

**Expected Behavior:**
- Downloads only Tagalog model during build
- Loads only Tagalog model at startup
- Memory usage: ~200-250MB ✅

### English Service (`philiready-websocket-english`)

**Environment Variables:**
```
SERVICE_LANGUAGE=english
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
VOSK_ENGLISH_MODEL_PATH=./model-english
PORT=2700
```

**Start Command:**
```bash
bash start.sh
```

**Expected Behavior:**
- Downloads only English model during build
- Loads only English model at startup
- Memory usage: ~200-250MB ✅

## How It Works

1. **Build Phase** (`build.sh`):
   - Checks `DOWNLOAD_TAGALOG` and `DOWNLOAD_ENGLISH` environment variables
   - Only downloads the model(s) specified
   - Saves build time and disk space

2. **Start Phase** (`start.sh`):
   - Checks `SERVICE_LANGUAGE` environment variable
   - If set to `tagalog` or `english`, only loads that model
   - If not set, loads both models (for backward compatibility)

3. **Server** (`server.py`):
   - Uses `--service-language` argument to determine which model to load
   - Only loads the specified model, saving memory

## Memory Comparison

| Configuration | RAM Usage | Status |
|---------------|-----------|--------|
| Both models (old) | ~400-450MB | ❌ Crashes on 512MB |
| Tagalog only | ~200-250MB | ✅ Safe |
| English only | ~200-250MB | ✅ Safe |
| Separate services | ~200-250MB each | ✅ Best |

## Troubleshooting

### Service Still Crashes

1. **Check environment variables:**
   ```bash
   # In Railway dashboard, verify:
   SERVICE_LANGUAGE=tagalog  # or english
   DOWNLOAD_TAGALOG=true     # for Tagalog service
   DOWNLOAD_ENGLISH=false    # for Tagalog service
   ```

2. **Check logs:**
   - Should see: "Loading Tagalog model from: ./model-tagalog" (for Tagalog service)
   - Should NOT see: "Loading English model" (for Tagalog service)
   - If you see both, `SERVICE_LANGUAGE` is not set correctly

3. **Verify model paths:**
   - Tagalog service: `./model-tagalog` should exist
   - English service: `./model-english` should exist

### Model Not Loading

- Check build logs to ensure model was downloaded
- Verify `DOWNLOAD_TAGALOG` or `DOWNLOAD_ENGLISH` is set correctly
- Check that model directory exists after build

### Wrong Language Service

- Verify `SERVICE_LANGUAGE` is set correctly in Railway dashboard
- Check that the correct model is being downloaded (check build logs)
- Ensure `DOWNLOAD_TAGALOG`/`DOWNLOAD_ENGLISH` match the service language

## Quick Setup Checklist

### For Tagalog Service:
- [ ] Set `SERVICE_LANGUAGE=tagalog`
- [ ] Set `DOWNLOAD_TAGALOG=true`
- [ ] Set `DOWNLOAD_ENGLISH=false`
- [ ] Verify build logs show only Tagalog model download
- [ ] Verify deploy logs show only Tagalog model loading

### For English Service:
- [ ] Set `SERVICE_LANGUAGE=english`
- [ ] Set `DOWNLOAD_TAGALOG=false`
- [ ] Set `DOWNLOAD_ENGLISH=true`
- [ ] Verify build logs show only English model download
- [ ] Verify deploy logs show only English model loading

---

**Last Updated**: November 22, 2025

