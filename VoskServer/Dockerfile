# Dockerfile for VoskServer
# Can be used with Railway, Fly.io, or any Docker-compatible platform

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Expose port (will be overridden by platform)
EXPOSE 2700

# Start the server
CMD ["bash", "start.sh"]

