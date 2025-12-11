import os
import signal

# Kill process on port 2700
pid = 10528
try:
    os.kill(pid, signal.SIGTERM)
    print(f"✓ Killed process {pid}")
except:
    print(f"✗ Could not kill process {pid}")
