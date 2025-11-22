# Railway WebSocket Connection Issues - Diagnostic Guide

## Problem: Services Deployed but Frontend Shows "Disconnected"

If your Railway services show as "successfully deployed" but the frontend can't connect, follow these steps:

### 1. ✅ Verify Service is Actually Running

In Railway dashboard:
1. Open your service (e.g., `philiready-websocket-english`)
2. Check the **Status** indicator:
   - 🟢 **Running** = Good
   - 🔴 **Stopped** = Service not running
   - 🟡 **Crashed** = Service crashed

### 2. 📋 Check Service Logs for Startup Messages

Look for these **success indicators**:
```
Starting VoskServer...
Checking for models...
✓ English model loaded
Starting WebSocket server on port 2700
Supported languages: ['english']
```

**If you see errors instead:**
- `❌ Error: No models loaded` → Check environment variables
- `❌ Error: English model path does not exist` → Model didn't download
- `Ran out of memory` → Service needs more memory or optimization

### 3. 🔍 Verify WebSocket Server is Listening

The server should print:
```
Starting WebSocket server on port 2700
```

**Important**: Railway automatically maps the `PORT` environment variable. Make sure:
- `PORT=2700` is set (or Railway will assign a random port)
- The service is listening on `0.0.0.0` (not `127.0.0.1` or `localhost`)

### 4. 🌐 Test WebSocket Connection Manually

Open browser console and test:

```javascript
// Test English service
const ws = new WebSocket('wss://philiready-websocket-english.up.railway.app/?lang=english');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = (e) => console.log('🔴 Closed:', e.code, e.reason);

// Test Tagalog service
const ws2 = new WebSocket('wss://vigilant-celebration.up.railway.app/?lang=tagalog');
ws2.onopen = () => console.log('✅ Connected!');
ws2.onerror = (e) => console.error('❌ Error:', e);
ws2.onclose = (e) => console.log('🔴 Closed:', e.code, e.reason);
```

**Common close codes:**
- `1006` = Connection refused/unreachable (service not running or sleeping)
- `1008` = Policy violation (service rejected connection)
- `1011` = Internal server error (service crashed)

### 5. ⚙️ Verify Environment Variables

#### English Service (`philiready-websocket-english`):
```
SERVICE_LANGUAGE=english
DOWNLOAD_TAGALOG=false
DOWNLOAD_ENGLISH=true
VOSK_ENGLISH_MODEL_PATH=./model-english
HUGGINGFACE_ENGLISH_MODEL_REPO=Migueldrm/vosk-model-en-us-0.22-lgraph
PORT=2700
```

#### Tagalog Service (`vigilant-celebration`):
```
SERVICE_LANGUAGE=tagalog
DOWNLOAD_TAGALOG=true
DOWNLOAD_ENGLISH=false
VOSK_TAGALOG_MODEL_PATH=./model-tagalog
HUGGINGFACE_TAGALOG_MODEL_REPO=Migueldrm/vosk-model-tl-ph-generic-0.6
PORT=2700
```

### 6. 🔄 Railway-Specific Issues

#### Issue: Service Shows "Deployed" but Connection Fails

**Possible causes:**
1. **Service is sleeping** (free tier)
   - First connection after sleep takes 30-60 seconds
   - Solution: Wait and retry, or upgrade to paid plan

2. **Wrong port configuration**
   - Railway assigns `PORT` automatically
   - Make sure your code uses `os.getenv("PORT")` or `process.env.PORT`
   - Don't hardcode port numbers

3. **Service crashed after startup**
   - Check logs for crash errors
   - Common: Out of memory, missing dependencies, model download failed

4. **WebSocket upgrade not working**
   - Railway should handle this automatically
   - If not, check Railway service settings for WebSocket support

#### Issue: Connection Works in Browser Console but Not in App

**Possible causes:**
1. **CORS issues** (unlikely for WebSocket, but check)
2. **Environment variables not set in frontend**
   - Check `VITE_VOSK_WS_URL_ENGLISH` and `VITE_VOSK_WS_URL_TAGALOG`
   - Rebuild frontend after setting env vars
3. **URL format mismatch**
   - Frontend expects: `wss://service.up.railway.app/?lang=english`
   - Make sure URL includes `/` before query params

### 7. 🧪 Quick Diagnostic Checklist

- [ ] Service status shows "Running" in Railway
- [ ] Logs show "Starting WebSocket server on port 2700"
- [ ] Logs show "✓ English model loaded" or "✓ Tagalog model loaded"
- [ ] `SERVICE_LANGUAGE` environment variable is set correctly
- [ ] `PORT=2700` is set (or Railway auto-assigned port)
- [ ] Manual WebSocket test in browser console works
- [ ] Frontend environment variables are set
- [ ] Frontend has been rebuilt after setting env vars

### 8. 🔧 Common Fixes

1. **Restart the service** in Railway dashboard
2. **Redeploy** if environment variables were changed
3. **Check Railway status page** for platform issues
4. **Wait 30-60 seconds** if service is on free tier (may be sleeping)
5. **Verify service name** matches the URL you're using
6. **Check Railway logs** for specific error messages

### 9. 📞 Still Not Working?

1. Share the **exact error message** from browser console
2. Share the **close code** from WebSocket `onclose` event
3. Share relevant **Railway service logs**
4. Verify the **service URL** matches what's in Railway dashboard

---

## Quick Test Script

Save this as `test-websocket.html` and open in browser:

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>Railway WebSocket Test</h1>
    <button onclick="testEnglish()">Test English</button>
    <button onclick="testTagalog()">Test Tagalog</button>
    <pre id="output"></pre>
    
    <script>
        const output = document.getElementById('output');
        
        function log(msg) {
            output.textContent += new Date().toISOString() + ': ' + msg + '\n';
        }
        
        function testEnglish() {
            log('Testing English service...');
            const ws = new WebSocket('wss://philiready-websocket-english.up.railway.app/?lang=english');
            ws.onopen = () => log('✅ English: Connected!');
            ws.onerror = (e) => log('❌ English: Error - ' + JSON.stringify(e));
            ws.onclose = (e) => log(`🔴 English: Closed - Code: ${e.code}, Reason: ${e.reason || 'none'}, Clean: ${e.wasClean}`);
        }
        
        function testTagalog() {
            log('Testing Tagalog service...');
            const ws = new WebSocket('wss://vigilant-celebration.up.railway.app/?lang=tagalog');
            ws.onopen = () => log('✅ Tagalog: Connected!');
            ws.onerror = (e) => log('❌ Tagalog: Error - ' + JSON.stringify(e));
            ws.onclose = (e) => log(`🔴 Tagalog: Closed - Code: ${e.code}, Reason: ${e.reason || 'none'}, Clean: ${e.wasClean}`);
        }
    </script>
</body>
</html>
```

