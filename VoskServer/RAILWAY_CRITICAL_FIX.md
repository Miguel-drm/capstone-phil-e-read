# 🚨 Critical: Railway WebSocket Connection Fix

## Problem: Error 1006 (Connection Refused)

If you're seeing **Error Code 1006** (Abnormal closure - connection refused/unreachable) after 2 seconds, this means the Railway service is **not responding** to WebSocket connections.

## Immediate Checks

### 1. ✅ Verify Service is Actually Running

**In Railway Dashboard:**
1. Open your service (e.g., `philiready-websocket-english`)
2. Check the **Status** - it should show **🟢 Running**
3. If it shows **🔴 Stopped** or **🟡 Crashed**, click **Restart** or **Deploy**

### 2. 📋 Check Logs for "✅ WebSocket server started"

**Scroll to the END of your Railway logs** and look for:

```
✅ WebSocket server started successfully on port 2700
🌐 Listening on 0.0.0.0:2700
📡 Ready to accept connections
```

**If you DON'T see these messages:**
- The server is **crashing** or **hanging** after model loading
- Check for error messages in the logs
- Look for Python exceptions or port conflicts

### 3. ⚙️ Critical: PORT Environment Variable

**Railway automatically assigns a PORT** - your service MUST use it!

**Check your Railway service environment variables:**
- ❌ **DON'T** set `PORT=2700` manually
- ✅ **DO** let Railway auto-assign the port
- ✅ **DO** make sure your code uses `os.getenv("PORT")`

**The server.py code should be:**
```python
port = int(os.getenv("PORT", "2700"))  # Railway auto-assigns PORT
```

**If you hardcoded PORT=2700:**
- Railway might assign a different port (e.g., 12345)
- Your service listens on 2700, but Railway routes to 12345
- Result: Connection refused (1006)

### 4. 🔍 Verify Service is Listening on 0.0.0.0

**Your server MUST listen on `0.0.0.0`, not `127.0.0.1` or `localhost`**

Check `server.py` line 173:
```python
async with websockets.serve(wrapped_handler, "0.0.0.0", args.port, max_size=None):
```

✅ **Correct**: `"0.0.0.0"` (listens on all interfaces)
❌ **Wrong**: `"127.0.0.1"` or `"localhost"` (only local connections)

### 5. 🧪 Test Connection Directly

**In Railway Dashboard:**
1. Go to your service
2. Click **Settings** → **Networking**
3. Find the **Public Domain** - it should be something like:
   - `philiready-websocket-english.up.railway.app`

**Test in browser console:**
```javascript
const ws = new WebSocket('wss://philiready-websocket-english.up.railway.app/?lang=english');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = (e) => console.log('🔴 Closed:', e.code, e.reason);
```

**If this also fails with 1006:**
- Service is not running or not listening
- Check Railway logs for errors
- Verify the service URL matches Railway dashboard

## Common Causes of 1006 Error

### Cause 1: Service Crashed After Startup
**Symptoms:**
- Logs show model loading
- Logs show "Starting WebSocket server..."
- But NO "✅ WebSocket server started successfully"
- Service status shows "Crashed"

**Fix:**
- Check logs for Python exceptions
- Look for "Out of memory" errors
- Verify environment variables are correct
- Restart the service

### Cause 2: Wrong Port Configuration
**Symptoms:**
- Service shows "Running"
- But connection fails immediately (1006)

**Fix:**
- **Remove** `PORT=2700` from environment variables
- Let Railway auto-assign the port
- Redeploy the service

### Cause 3: Service Sleeping (Free Tier)
**Symptoms:**
- First connection takes 30-60 seconds
- Subsequent connections work fine

**Fix:**
- Wait 30-60 seconds for first connection
- Or upgrade to paid plan to prevent sleeping

### Cause 4: Service Not Listening on 0.0.0.0
**Symptoms:**
- Service shows "Running"
- But connection refused

**Fix:**
- Verify `server.py` uses `"0.0.0.0"` not `"127.0.0.1"`
- Redeploy the service

## Step-by-Step Fix

1. **Open Railway Dashboard**
2. **Check Service Status** - should be "Running"
3. **Check Logs** - scroll to the very end
4. **Look for "✅ WebSocket server started successfully"**
5. **If NOT present:**
   - Check for error messages
   - Verify environment variables
   - Remove `PORT=2700` if manually set
   - Restart the service
6. **If present but still failing:**
   - Check the PORT in logs matches Railway's assigned port
   - Verify service URL matches Railway dashboard
   - Test connection manually in browser console

## Environment Variables Checklist

### English Service (`philiready-websocket-english`):
```
SERVICE_LANGUAGE=english
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
VOSK_ENGLISH_MODEL_PATH=./model-english
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
```
**⚠️ DO NOT SET PORT=2700** - Let Railway auto-assign it!

### Tagalog Service (`vigilant-celebration`):
```
SERVICE_LANGUAGE=tagalog
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
VOSK_TAGALOG_MODEL_PATH=./model-tagalog
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
```
**⚠️ DO NOT SET PORT=2700** - Let Railway auto-assign it!

## Still Not Working?

1. **Share the last 20 lines of Railway logs** for both services
2. **Share the service status** (Running/Stopped/Crashed)
3. **Share the PORT value** shown in Railway logs vs. what Railway assigned
4. **Test the connection manually** in browser console and share the result

