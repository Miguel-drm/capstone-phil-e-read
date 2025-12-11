import os
import signal
import time
import subprocess

# Kill process on port 2700
pid = 12772
try:
    os.kill(pid, signal.SIGTERM)
    print(f"✓ Killed process {pid}")
    time.sleep(3)
except Exception as e:
    print(f"✗ Could not kill process {pid}: {e}")

# Start new server
print("Starting server with fixed code...")
subprocess.Popen(["python", "server.py", "--port", "2700"])
print("✓ Server starting...")
