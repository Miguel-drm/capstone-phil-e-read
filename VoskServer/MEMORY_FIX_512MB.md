# Memory Optimization Fix for 512MB Limit

## Problem
The Vosk server was exceeding Render's 512MB RAM limit and crashing with "Out of memory" errors.

## Solution: Aggressive Memory Optimizations

### Changes Made

1. **Reduced MAX_CONNECTIONS from 10 to 3**
   - Each connection uses ~10-20MB RAM
   - 3 connections = ~30-60MB overhead (much safer)
   - Old: 10 connections = ~100-200MB overhead ❌
   - New: 3 connections = ~30-60MB overhead ✅

2. **Automatic Model Unloading**
   - Models are automatically unloaded after 10 minutes of inactivity
   - Only one model loaded at a time if possible
   - Saves ~200-250MB when a model is unloaded

3. **Connection Timeouts**
   - Idle connections are closed after 5 minutes
   - Prevents memory leaks from abandoned connections
   - Frees up resources automatically

4. **Disabled Word-Level Timestamps**
   - `VOSK_ENABLE_WORDS=false` saves ~10-20MB per model
   - Word timestamps are not critical for basic recognition
   - Can be re-enabled if needed (uses more memory)

5. **Periodic Memory Cleanup**
   - Runs every 60 seconds
   - Unloads unused models
   - Cleans up connection tracking
   - Forces garbage collection

6. **Message Size Limits**
   - Limited WebSocket message size to 1MB (was unlimited)
   - Prevents memory spikes from large messages

7. **Emergency Memory Management**
   - If loading a model fails due to memory, automatically unloads other models
   - Retries loading after cleanup
   - Prevents crashes from memory exhaustion

## Expected Memory Usage

### Startup (No Models Loaded)
- Base server: ~50-80MB ✅

### With One Model Loaded
- Tagalog only: ~250-300MB ✅
- English LGraph only: ~200-250MB ✅

### With Both Models Loaded (Worst Case)
- Tagalog + English LGraph: ~400-450MB ✅
- Still under 512MB with ~60MB buffer

### With 3 Active Connections
- Base: ~400-450MB (both models)
- Connection overhead: ~30-60MB
- **Total: ~430-510MB** ✅ (Tight but should work)

## Environment Variables

Add these to your Render service:

```env
# Connection limits (CRITICAL)
MAX_CONNECTIONS=3                    # Maximum concurrent connections
CONNECTION_TIMEOUT=300               # Close idle connections after 5 minutes

# Model management
MODEL_UNLOAD_TIMEOUT=600            # Unload unused models after 10 minutes
VOSK_LAZY_LOAD=true                 # Load models on-demand
VOSK_ENABLE_WORDS=false             # Disable word timestamps (saves memory)

# Memory optimization
VOSK_LAZY_LOAD=true                 # Always use lazy loading
```

## Monitoring

The server now logs memory usage (if psutil is available):
```
📊 Memory usage: 387.2 MB | Active connections: 2/3 | Loaded models: ['tagalog', 'english']
```

## Recommendations

### If Still Exceeding 512MB:

1. **Deploy Separate Services** (Best Option)
   - Deploy Tagalog-only service
   - Deploy English-only service
   - Each uses ~200-250MB ✅
   - Most reliable for free tier

2. **Reduce MAX_CONNECTIONS to 2**
   ```env
   MAX_CONNECTIONS=2
   ```

3. **Increase MODEL_UNLOAD_TIMEOUT**
   - Unload models faster (e.g., 300 seconds = 5 minutes)
   ```env
   MODEL_UNLOAD_TIMEOUT=300
   ```

4. **Use Only One Language**
   - Set `DOWNLOAD_ENGLISH=false` or `DOWNLOAD_TAGALOG=false`
   - Only one model = ~200-250MB ✅

5. **Upgrade to Starter Plan**
   - $7/month = 2GB RAM
   - Can handle 10+ connections easily
   - No memory constraints

## Testing

After deploying, monitor the Render logs for:
- ✅ "Memory usage: XXX MB" (should be <500MB)
- ✅ "Active connections: X/3" (should never exceed 3)
- ✅ No "Out of memory" errors
- ✅ Models unloading when idle: "🗑️ Periodic cleanup: Unloading unused X model"

## Troubleshooting

### Still Getting OOM Errors?

1. Check Render logs for actual memory usage
2. Verify `MAX_CONNECTIONS=3` is set
3. Check if both models are loaded simultaneously
4. Consider deploying separate services

### Connections Being Rejected?

- This is expected! Server limits to 3 connections
- Wait for a connection to close, or increase `MAX_CONNECTIONS` (if you upgrade plan)

### Models Not Loading?

- Check HuggingFace model repositories are correct
- Verify models downloaded during build
- Check Render build logs for download errors

---

**Status**: ✅ Optimized for 512MB free tier
**Last Updated**: November 22, 2025

