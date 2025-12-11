import os
import signal
import time
import subprocess
import re

# Find process on port 2700
result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
for line in result.stdout.split('\n'):
    if ':2700' in line and 'LISTENING' in line:
        parts = line.split()
        pid = int(parts[-1])
        print(f"Found process {pid} on port 2700")
        try:
            os.kill(pid, signal.SIGTERM)
            print(f"✓ Killed process {pid}")
            time.sleep(3)
        except Exception as e:
            print(f"✗ Could not kill process {pid}: {e}")
        break

# Start new server
print("Starting server with CONTEXT-AWARE fix...")
subprocess.Popen(["python", "server.py", "--port", "2700"])
print("✓ Server starting with enhanced substitution detection...")
