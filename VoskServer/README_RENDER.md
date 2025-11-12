# Deploying VoskServer to Render

This guide will help you deploy the VoskServer to Render with the model from Hugging Face.

## Model Source

The server is configured to use the model from:
**https://huggingface.co/Migueldrm/vosk-model-tl-ph-generic-0.6**

## Prerequisites

1. A Render account (sign up at https://render.com)
2. A GitHub repository with your VoskServer code

## Deployment Steps

### Option 1: Using Render Dashboard (Recommended)

1. **Create a New Web Service**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository containing VoskServer

2. **Configure the Service**
   - **Name**: `vosk-server` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `VoskServer` (if VoskServer is in a subdirectory)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `bash start.sh`

3. **Set Environment Variables** (Optional - defaults are set)
   - `VOSK_MODEL_PATH`: `./model` (default)
   - `HUGGINGFACE_MODEL_REPO`: `Migueldrm/vosk-model-tl-ph-generic-0.6` (default)
   
   **Note**: You don't need a `.env` file for Render. Set these in the Render dashboard under "Environment" tab if you want to override defaults. Render does not use `.env` files.

4. **Select Plan**
   - **Free**: Limited resources, spins down after inactivity
   - **Starter**: $7/month, always on
   - Choose based on your needs

5. **Deploy**
   - Click "Create Web Service"
   - Render will:
     - Install dependencies
     - Download the model from Hugging Face (first time takes a few minutes)
     - Start the WebSocket server

### Option 2: Using render.yaml (Infrastructure as Code)

If you're using `render.yaml`:

1. **Push your code to GitHub** (including `render.yaml`)

2. **Create a Blueprint**
   - Go to Render Dashboard → "Blueprints"
   - Click "New Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create the service

3. **Deploy**
   - Review the configuration
   - Click "Apply" to deploy

## How It Works

1. **First Deployment:**
   - Render installs Python dependencies
   - `start.sh` runs `download_huggingface_model.py`
   - The script downloads the model from Hugging Face to `./model`
   - Server starts with the downloaded model

2. **Subsequent Deployments:**
   - If model already exists, download is skipped
   - Server starts immediately

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `2700` | No (Render sets this automatically) |
| `VOSK_MODEL_PATH` | Path to Vosk model directory | `./model` | No |
| `HUGGINGFACE_MODEL_REPO` | Hugging Face model repository | `Migueldrm/vosk-model-tl-ph-generic-0.6` | No |

**Important**: 
- ❌ **Don't create a `.env` file for Render** - Render doesn't use `.env` files
- ✅ **Set environment variables in Render Dashboard** → Your Service → "Environment" tab
- ✅ **Defaults work automatically** - You don't need to set anything if defaults are fine

## WebSocket Connection

Once deployed, your WebSocket server will be available at:
- `wss://your-service-name.onrender.com`

**Note**: 
- Render supports WebSockets on all plans
- Free tier services spin down after 15 minutes of inactivity
- Use Starter plan ($7/month) for always-on service

## Model Download

The model is downloaded from Hugging Face using the `huggingface_hub` library:
- **Repository**: `Migueldrm/vosk-model-tl-ph-generic-0.6`
- **Location**: https://huggingface.co/Migueldrm/vosk-model-tl-ph-generic-0.6
- **Download Location**: `./model` (in your service directory)

The download happens automatically on first startup and is cached for subsequent deployments.

## Troubleshooting

1. **Model download fails:**
   - Check Render logs for errors
   - Verify Hugging Face repository is accessible
   - Ensure `huggingface_hub` is installed (included in requirements.txt)

2. **Service won't start:**
   - Check that `start.sh` has execute permissions
   - Verify Python version (Render uses Python 3.11+)
   - Check logs for specific error messages

3. **WebSocket connection issues:**
   - Ensure you're using `wss://` (secure WebSocket)
   - Check that service is running (not spun down on free tier)
   - Verify PORT environment variable is set

4. **Model not found:**
   - Check `VOSK_MODEL_PATH` environment variable
   - Verify model downloaded successfully (check logs)
   - Model should be in `./model` directory

5. **Build timeout:**
   - Large model downloads may take time
   - Render has build time limits (free: 10 min, paid: longer)
   - If timeout occurs, the model will download on first startup instead

## Updating the Deployment

Simply push changes to your GitHub repository, and Render will automatically redeploy.

To update the model:
- Push a new version to Hugging Face
- Redeploy the service (model will be re-downloaded)

## Cost Considerations

- **Free Tier**: 
  - Spins down after 15 min inactivity
  - Limited build time (10 minutes)
  - Good for testing

- **Starter Plan ($7/month)**:
  - Always on
  - Better for production
  - Recommended for WebSocket services

## Files Structure

```
VoskServer/
├── server.py                    # Main WebSocket server
├── download_huggingface_model.py # Model download script
├── start.sh                     # Startup script
├── requirements.txt             # Python dependencies
├── render.yaml                  # Render configuration (optional)
└── README_RENDER.md            # This file
```

## Support

For issues with:
- **Render**: Check Render documentation at https://render.com/docs
- **Hugging Face**: Check Hugging Face Hub docs at https://huggingface.co/docs/hub
- **Vosk**: Check Vosk documentation at https://alphacephei.com/vosk

