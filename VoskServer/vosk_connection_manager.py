#!/usr/bin/env python3
"""
Vosk Connection Manager - Smart Server Detection and Fallback
==============================================================

Automatically detects if local Vosk server is running and falls back to Railway.

Features:
- Detects local server on ws://localhost:2700
- Falls back to Railway wss://philiready-websocket-production.up.railway.app
- Health check with timeout
- Connection retry logic
- Language-specific endpoints

Usage:
    from vosk_connection_manager import VoskConnectionManager
    
    # Create manager
    manager = VoskConnectionManager(language="english")
    
    # Get WebSocket URI (automatically detects local or Railway)
    uri = await manager.get_websocket_uri()
    
    # Connect to WebSocket
    async with websockets.connect(uri) as ws:
        # Use websocket...
"""

import asyncio
import socket
import websockets
import json
from typing import Optional, Literal
from dataclasses import dataclass
import time

# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class ServerConfig:
    """Configuration for Vosk server endpoints."""
    local_host: str = "localhost"
    local_port: int = 2700
    railway_url: str = "philiready-websocket-production.up.railway.app"  # Single server handles both languages
    health_check_timeout: float = 2.0  # seconds
    connection_timeout: float = 5.0    # seconds
    max_retries: int = 3
    retry_delay: float = 1.0           # seconds


# ============================================================================
# CONNECTION MANAGER
# ============================================================================

class VoskConnectionManager:
    """
    Smart connection manager for Vosk WebSocket server.
    
    Automatically detects if local server is running and falls back to Railway.
    """
    
    def __init__(
        self,
        language: Literal["english", "tagalog"] = "english",
        config: Optional[ServerConfig] = None,
        prefer_local: bool = True,
        verbose: bool = True
    ):
        """
        Initialize connection manager.
        
        Args:
            language: Language for speech recognition ("english" or "tagalog")
            config: Server configuration (uses defaults if None)
            prefer_local: If True, tries local server first before Railway
            verbose: If True, prints connection status messages
        """
        self.language = language.lower()
        self.config = config or ServerConfig()
        self.prefer_local = prefer_local
        self.verbose = verbose
        
        # Connection state
        self._local_available: Optional[bool] = None
        self._last_check_time: float = 0
        self._check_cache_duration: float = 30.0  # Cache health check for 30 seconds
        
        # Build URIs
        self._local_uri = f"ws://{self.config.local_host}:{self.config.local_port}/?lang={self.language}"
        self._railway_uri = f"wss://{self.config.railway_url}/?lang={self.language}"
    
    def _log(self, message: str, level: str = "info"):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            emoji = {
                "info": "ℹ️",
                "success": "✅",
                "warning": "⚠️",
                "error": "❌",
                "check": "🔍",
                "local": "🏠",
                "cloud": "☁️"
            }.get(level, "•")
            print(f"{emoji} {message}")
    
    async def _check_port_open(self, host: str, port: int, timeout: float) -> bool:
        """
        Check if a TCP port is open and accepting connections.
        
        Args:
            host: Hostname or IP address
            port: Port number
            timeout: Timeout in seconds
            
        Returns:
            True if port is open, False otherwise
        """
        try:
            # Use asyncio to check port with timeout
            future = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(future, timeout=timeout)
            writer.close()
            await writer.wait_closed()
            return True
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            return False
        except Exception as e:
            self._log(f"Unexpected error checking port: {e}", "warning")
            return False
    
    async def _check_websocket_health(self, uri: str, timeout: float) -> bool:
        """
        Check if WebSocket server is healthy by attempting connection.
        
        Args:
            uri: WebSocket URI
            timeout: Timeout in seconds
            
        Returns:
            True if server is healthy, False otherwise
        """
        try:
            # Try to connect with timeout
            async with asyncio.timeout(timeout):
                async with websockets.connect(uri) as ws:
                    # Send a ping to verify server is responsive
                    await ws.ping()
                    return True
        except asyncio.TimeoutError:
            return False
        except (websockets.exceptions.WebSocketException, OSError, ConnectionRefusedError):
            return False
        except Exception as e:
            self._log(f"Unexpected error in health check: {e}", "warning")
            return False
    
    async def is_local_server_available(self, force_check: bool = False) -> bool:
        """
        Check if local Vosk server is running and available.
        
        Uses caching to avoid repeated checks. Cache expires after 30 seconds.
        
        Args:
            force_check: If True, bypasses cache and performs fresh check
            
        Returns:
            True if local server is available, False otherwise
        """
        current_time = time.time()
        
        # Use cached result if available and not expired
        if not force_check and self._local_available is not None:
            if current_time - self._last_check_time < self._check_cache_duration:
                return self._local_available
        
        self._log("Checking local server availability...", "check")
        
        # Step 1: Quick port check (faster than WebSocket connection)
        port_open = await self._check_port_open(
            self.config.local_host,
            self.config.local_port,
            timeout=0.5  # Very quick check
        )
        
        if not port_open:
            self._log(f"Local server port {self.config.local_port} is not open", "info")
            self._local_available = False
            self._last_check_time = current_time
            return False
        
        # Step 2: WebSocket health check (verifies server is responding)
        is_healthy = await self._check_websocket_health(
            self._local_uri,
            timeout=self.config.health_check_timeout
        )
        
        if is_healthy:
            self._log(f"Local server is available at {self._local_uri}", "local")
        else:
            self._log("Local server port is open but not responding", "warning")
        
        self._local_available = is_healthy
        self._last_check_time = current_time
        return is_healthy
    
    async def get_websocket_uri(self, force_check: bool = False) -> str:
        """
        Get the appropriate WebSocket URI (local or Railway).
        
        Automatically detects if local server is running and falls back to Railway.
        
        Args:
            force_check: If True, bypasses cache and performs fresh server check
            
        Returns:
            WebSocket URI string
        """
        if self.prefer_local:
            # Try local server first
            local_available = await self.is_local_server_available(force_check)
            
            if local_available:
                self._log(f"Using local server: {self._local_uri}", "local")
                return self._local_uri
            else:
                self._log(f"Local server not available, using Railway: {self._railway_uri}", "cloud")
                return self._railway_uri
        else:
            # Use Railway directly (skip local check)
            self._log(f"Using Railway server: {self._railway_uri}", "cloud")
            return self._railway_uri
    
    async def connect(
        self,
        force_check: bool = False,
        retry: bool = True
    ) -> websockets.WebSocketClientProtocol:
        """
        Connect to Vosk WebSocket server with automatic fallback.
        
        Args:
            force_check: If True, bypasses cache and performs fresh server check
            retry: If True, retries connection on failure
            
        Returns:
            Connected WebSocket client
            
        Raises:
            ConnectionError: If connection fails after all retries
        """
        uri = await self.get_websocket_uri(force_check)
        
        retries = self.config.max_retries if retry else 1
        last_error = None
        
        for attempt in range(retries):
            try:
                self._log(f"Connecting to {uri} (attempt {attempt + 1}/{retries})...", "info")
                
                ws = await asyncio.wait_for(
                    websockets.connect(uri),
                    timeout=self.config.connection_timeout
                )
                
                self._log("Connected successfully!", "success")
                return ws
                
            except asyncio.TimeoutError:
                last_error = f"Connection timeout after {self.config.connection_timeout}s"
                self._log(last_error, "warning")
                
            except (websockets.exceptions.WebSocketException, OSError, ConnectionRefusedError) as e:
                last_error = f"Connection failed: {e}"
                self._log(last_error, "warning")
            
            # If this was a local connection attempt and it failed, try Railway
            if uri == self._local_uri and attempt == 0:
                self._log("Local connection failed, trying Railway...", "info")
                self._local_available = False  # Mark local as unavailable
                uri = self._railway_uri
                continue
            
            # Wait before retry
            if attempt < retries - 1:
                await asyncio.sleep(self.config.retry_delay)
        
        # All retries failed
        error_msg = f"Failed to connect after {retries} attempts. Last error: {last_error}"
        self._log(error_msg, "error")
        raise ConnectionError(error_msg)
    
    def get_server_info(self) -> dict:
        """
        Get information about server configuration and status.
        
        Returns:
            Dictionary with server information
        """
        return {
            "language": self.language,
            "prefer_local": self.prefer_local,
            "local_uri": self._local_uri,
            "railway_uri": self._railway_uri,
            "local_available": self._local_available,
            "last_check_time": self._last_check_time,
            "config": {
                "local_host": self.config.local_host,
                "local_port": self.config.local_port,
                "railway_url": self.config.railway_url,
                "health_check_timeout": self.config.health_check_timeout,
                "connection_timeout": self.config.connection_timeout,
                "max_retries": self.config.max_retries,
            }
        }


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

async def get_vosk_uri(
    language: Literal["english", "tagalog"] = "english",
    prefer_local: bool = True,
    verbose: bool = True
) -> str:
    """
    Convenience function to get Vosk WebSocket URI.
    
    Args:
        language: Language for speech recognition
        prefer_local: If True, tries local server first
        verbose: If True, prints status messages
        
    Returns:
        WebSocket URI string
    """
    manager = VoskConnectionManager(language, prefer_local=prefer_local, verbose=verbose)
    return await manager.get_websocket_uri()


async def connect_to_vosk(
    language: Literal["english", "tagalog"] = "english",
    prefer_local: bool = True,
    verbose: bool = True,
    retry: bool = True
) -> websockets.WebSocketClientProtocol:
    """
    Convenience function to connect to Vosk WebSocket server.
    
    Args:
        language: Language for speech recognition
        prefer_local: If True, tries local server first
        verbose: If True, prints status messages
        retry: If True, retries connection on failure
        
    Returns:
        Connected WebSocket client
    """
    manager = VoskConnectionManager(language, prefer_local=prefer_local, verbose=verbose)
    return await manager.connect(retry=retry)


# ============================================================================
# MAIN FUNCTION (DEMO)
# ============================================================================

async def main():
    """Demonstrate the connection manager."""
    print("=" * 70)
    print("  VOSK CONNECTION MANAGER - DEMO")
    print("=" * 70)
    print()
    
    # Test English connection
    print("Testing English connection:")
    print("-" * 70)
    manager_en = VoskConnectionManager(language="english", verbose=True)
    
    # Get server info
    info = manager_en.get_server_info()
    print(f"\nServer Configuration:")
    print(f"  Language: {info['language']}")
    print(f"  Local URI: {info['local_uri']}")
    print(f"  Railway URI: {info['railway_uri']}")
    print()
    
    # Check local server
    local_available = await manager_en.is_local_server_available()
    print(f"\nLocal Server Status: {'Available' if local_available else 'Not Available'}")
    print()
    
    # Get URI
    uri = await manager_en.get_websocket_uri()
    print(f"Selected URI: {uri}")
    print()
    
    # Try to connect
    try:
        print("Attempting connection...")
        ws = await manager_en.connect()
        print("✅ Connection successful!")
        
        # Send a test message
        await ws.send(json.dumps({"test": "hello"}))
        
        # Close connection
        await ws.close()
        print("✅ Connection closed cleanly")
    except ConnectionError as e:
        print(f"❌ Connection failed: {e}")
    
    print()
    print("=" * 70)
    print()
    
    # Test Tagalog connection
    print("Testing Tagalog connection:")
    print("-" * 70)
    manager_tl = VoskConnectionManager(language="tagalog", verbose=True)
    uri_tl = await manager_tl.get_websocket_uri()
    print(f"Selected URI: {uri_tl}")
    print()
    print("=" * 70)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDemo stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
