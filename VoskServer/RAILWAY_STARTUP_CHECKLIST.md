# Railway WebSocket Services - Startup Checklist

## Expected Startup Sequence

When your Railway services start successfully, you should see these messages in order:

### 1. Model Download (if needed)
```
Starting VoskServer...
Checking for models...
Downloading English model from Hugging Face: Migueldrm/vosk-model-en-us-0.22-lgraph
Downloaded 1 model(s) successfully!
✓ English model downloaded successfully to ./model-english
```

### 2. Service Configuration
```
Starting WebSocket server...
🔧 Service language set to: english (loading only that model)
```

### 3. Model Loading
```
Loading English model from: ./model-english
LOG (VoskAPI:...) [various model loading messages]
✓ English model loaded
```

### 4. Server Startup ✅ **CRITICAL - Must see this!**
```
✓ Models loaded successfully: ['english']
🚀 Starting WebSocket server on port 2700...
Supported languages: ['english']
Usage: ws://host:port/?lang=tagalog or ws://host:port/?lang=english
✅ WebSocket server started successfully on port 2700
🌐 Listening on 0.0.0.0:2700
📡 Ready to accept connections
```

## If You DON'T See the Final Messages

If you see model loading but **NOT** the final "✅ WebSocket server started successfully" message, the server is likely:

1. **Hanging during startup** - Check for errors in logs
2. **Crashing silently** - Look for error messages before the logs stop
3. **Port conflict** - Railway might have assigned a different port

## Troubleshooting

### Issue: Model loads but server doesn't start

**Check:**
- Look for error messages after model loading
- Verify `PORT` environment variable is set (Railway auto-assigns)
- Check if there are any Python exceptions in the logs

**Fix:**
- Restart the service in Railway
- Check Railway logs for the full error message
- Verify environment variables are set correctly

### Issue: "Port already in use" error

**Check:**
- Railway automatically assigns `PORT` - don't hardcode it
- Make sure your code uses `os.getenv("PORT")` or `process.env.PORT`

**Fix:**
- Remove any hardcoded port numbers
- Let Railway assign the port automatically

### Issue: Model verification warning

**English Service:**
```
▲ Warning: English model downloaded but verification failed.
```

This is usually **OK** - the model still works, verification just failed. If recognition doesn't work, try:
- Re-downloading the model
- Using a different model repository
- Checking Railway logs for download errors

## Verification Steps

1. ✅ **Check Service Status** in Railway dashboard - should show "Running"
2. ✅ **Check Logs** - should see all 4 startup phases above
3. ✅ **Test Connection** - use browser console:
   ```javascript
   const ws = new WebSocket('wss://philiready-websocket-english.up.railway.app/?lang=english');
   ws.onopen = () => console.log('✅ Connected!');
   ws.onerror = (e) => console.error('❌ Error:', e);
   ws.onclose = (e) => console.log('🔴 Closed:', e.code);
   ```

## Expected Logs for Each Service

### English Service (`philiready-websocket-english`)
```
Service language set to: english (loading only that model)
Loading English model from: ./model-english
✓ English model loaded
✓ Models loaded successfully: ['english']
✅ WebSocket server started successfully on port 2700
```

### Tagalog Service (`vigilant-celebration`)
```
Service language set to: tagalog (loading only that model)
Loading Tagalog model from: ./model-tagalog
✓ Tagalog model loaded
✓ Models loaded successfully: ['tagalog']
✅ WebSocket server started successfully on port 2700
```

## Next Steps

After confirming both services show "✅ WebSocket server started successfully":

1. **Test from frontend** - Try connecting from your app
2. **Check browser console** - Look for connection logs
3. **Monitor Railway logs** - Watch for incoming connections when you test

If services are running but frontend still can't connect, check:
- Frontend environment variables (`VITE_VOSK_WS_URL_ENGLISH`, `VITE_VOSK_WS_URL_TAGALOG`)
- Service URLs match Railway dashboard
- Network/firewall isn't blocking WebSocket connections

