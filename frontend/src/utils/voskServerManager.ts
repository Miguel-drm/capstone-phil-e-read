/**
 * Vosk Server Manager
 * Handles Vosk server status checking, starting, and management
 */

import { useCallback, useEffect, useState } from 'react';

export type VoskServerStatus = {
  isRunning: boolean;
  isReachable: boolean;
  port: number;
  url: string;
  error?: string;
  lastChecked: number;
};

export type VoskServerConfig = {
  host: string;
  port: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
};

export class VoskServerManager {
  private config: VoskServerConfig;
  private statusCache: VoskServerStatus | null = null;
  private cacheTimeout = 5000; // 5 seconds cache
  private checkInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: ((status: VoskServerStatus) => void)[] = [];
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 1; // Reduced from 2 to 1 for faster backoff
  private backoffMultiplier = 4; // Increased from 3 to 4 for more aggressive backoff
  private maxBackoffInterval = 300000; // Increased to 5 minutes max
  private isChecking = false; // Prevent concurrent checks

  constructor(config?: Partial<VoskServerConfig>) {
    this.config = {
      host: 'localhost',
      port: 2700,
      timeout: 3000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Check if Vosk server is running and reachable
   */
  public async checkServerStatus(): Promise<VoskServerStatus> {
    // Prevent concurrent checks
    if (this.isChecking) {
      return this.statusCache || this.getDefaultStatus();
    }

    const now = Date.now();
    
    // Return cached status if still valid
    if (this.statusCache && (now - this.statusCache.lastChecked) < this.cacheTimeout) {
      return this.statusCache;
    }

    this.isChecking = true;

    const url = `ws://${this.config.host}:${this.config.port}`;
    
    const status: VoskServerStatus = {
      isRunning: false,
      isReachable: false,
      port: this.config.port,
      url,
      lastChecked: now
    };

    try {
      // Try to connect to WebSocket
      const isReachable = await this.testWebSocketConnection(url);
      
      status.isReachable = isReachable;
      status.isRunning = isReachable;
      
      if (isReachable) {
        // Reset failure count on success
        this.consecutiveFailures = 0;
      } else {
        // Increment failure count
        this.consecutiveFailures++;
        status.error = `Server not reachable - WebSocket connection failed (${this.consecutiveFailures} consecutive failures)`;
      }
      
    } catch (error) {
      this.consecutiveFailures++;
      status.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Only log errors for the first few failures to avoid spam
      if (this.consecutiveFailures <= this.maxConsecutiveFailures) {
        console.error('❌ Vosk server check failed:', error);
      } else if (this.consecutiveFailures === this.maxConsecutiveFailures + 1) {
        console.warn('⚠️ Vosk server unreachable - reducing check frequency and logging to avoid spam');
      }
      // After maxConsecutiveFailures, stop logging entirely to prevent spam
    } finally {
      this.isChecking = false;
    }

    // Cache the status
    this.statusCache = status;
    
    // Notify callbacks
    this.notifyStatusCallbacks(status);
    
    return status;
  }

  private getDefaultStatus(): VoskServerStatus {
    const url = `ws://${this.config.host}:${this.config.port}`;
    return {
      isRunning: false,
      isReachable: false,
      port: this.config.port,
      url,
      lastChecked: Date.now(),
      error: 'Status check in progress'
    };
  }

  /**
   * Test WebSocket connection to Vosk server
   */
  private testWebSocketConnection(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Use shorter timeout for failed connections to reduce wait time
      const timeoutDuration = this.consecutiveFailures > this.maxConsecutiveFailures 
        ? 1000 // 1 second for known failures
        : this.config.timeout; // Normal timeout for initial attempts
        
      const timeout = setTimeout(() => {
        resolve(false);
      }, timeoutDuration);

      try {
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          // Only log WebSocket errors for the first few attempts to avoid spam
          if (this.consecutiveFailures <= this.maxConsecutiveFailures) {
            console.warn(`WebSocket connection to '${url}' failed: ${error.type || 'Connection error'}`);
          }
          // After maxConsecutiveFailures, stop logging to prevent console spam
          resolve(false);
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          resolve(false);
        };
        
      } catch (error) {
        clearTimeout(timeout);
        // Only log catch errors for the first few attempts to prevent spam
        if (this.consecutiveFailures <= this.maxConsecutiveFailures) {
          console.warn(`WebSocket connection attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // After maxConsecutiveFailures, stop logging to prevent console spam
        resolve(false);
      }
    });
  }

  /**
   * Start monitoring server status with adaptive interval
   */
  public startMonitoring(baseInterval: number = 10000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const checkWithBackoff = async () => {
      await this.checkServerStatus();
      
      // Calculate adaptive interval based on consecutive failures
      let nextInterval = baseInterval;
      if (this.consecutiveFailures > this.maxConsecutiveFailures) {
        // Exponential backoff for persistent failures
        const backoffFactor = Math.min(
          Math.pow(this.backoffMultiplier, this.consecutiveFailures - this.maxConsecutiveFailures),
          this.maxBackoffInterval / baseInterval
        );
        nextInterval = Math.min(baseInterval * backoffFactor, this.maxBackoffInterval);
      }
      
      // Schedule next check
      this.checkInterval = setTimeout(checkWithBackoff, nextInterval);
    };

    // Start monitoring
    checkWithBackoff();
    console.log(`🔍 Started Vosk server monitoring (${baseInterval}ms base interval with adaptive backoff, max ${this.maxBackoffInterval}ms)`);
  }

  /**
   * Stop monitoring server status
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval); // Changed from clearInterval to clearTimeout
      this.checkInterval = null;
    }
    console.log('⏹️ Stopped Vosk server monitoring');
  }

  /**
   * Add status change callback
   */
  public onStatusChange(callback: (status: VoskServerStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Remove status change callback
   */
  public removeStatusCallback(callback: (status: VoskServerStatus) => void): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all status callbacks
   */
  private notifyStatusCallbacks(status: VoskServerStatus): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('❌ Error in status callback:', error);
      }
    });
  }

  /**
   * Get server start instructions
   */
  public getServerStartInstructions(): {
    windows: string[];
    linux: string[];
    docker: string[];
  } {
    return {
      windows: [
        '1. Open Command Prompt or PowerShell',
        '2. Navigate to VoskServer directory: cd VoskServer',
        '3. Run the server: python server.py',
        'Alternative: Double-click run.bat or restart_server.bat'
      ],
      linux: [
        '1. Open Terminal',
        '2. Navigate to VoskServer directory: cd VoskServer',
        '3. Make start script executable: chmod +x start.sh',
        '4. Run the server: ./start.sh',
        'Alternative: python server.py'
      ],
      docker: [
        '1. Build Docker image: docker build -t vosk-server .',
        '2. Run container: docker run -p 2700:2700 vosk-server',
        'Alternative: Use docker-compose if available'
      ]
    };
  }

  /**
   * Get troubleshooting tips
   */
  public getTroubleshootingTips(): string[] {
    return [
      'Check if Python is installed and accessible',
      'Verify all dependencies are installed: pip install -r requirements.txt',
      'Ensure port 2700 is not blocked by firewall',
      'Check if another process is using port 2700',
      'Verify Vosk models are downloaded and in correct location',
      'Try restarting the server: kill existing process and start again',
      'Check server logs for specific error messages'
    ];
  }

  /**
   * Attempt to kill existing server process (Windows)
   */
  public async killExistingServer(): Promise<boolean> {
    try {
      // This would need to be implemented with a backend endpoint
      // For now, we'll just provide instructions
      console.log('💡 To kill existing server:');
      console.log('Windows: Run kill_server.bat or kill_port_2700.py');
      console.log('Linux: pkill -f "python.*server.py" or lsof -ti:2700 | xargs kill');
      
      return false; // Can't actually kill from frontend
    } catch (error) {
      console.error('❌ Failed to kill server:', error);
      return false;
    }
  }

  /**
   * Get current cached status
   */
  public getCachedStatus(): VoskServerStatus | null {
    return this.statusCache;
  }

  /**
   * Clear status cache
   */
  public clearCache(): void {
    this.statusCache = null;
  }

  /**
   * Reset failure count (useful when user manually tries to reconnect)
   */
  public resetFailureCount(): void {
    this.consecutiveFailures = 0;
    console.log('🔄 Reset Vosk connection failure count');
  }

  /**
   * Get server health info
   */
  public async getServerHealth(): Promise<{
    status: VoskServerStatus;
    recommendations: string[];
    canAutoStart: boolean;
  }> {
    const status = await this.checkServerStatus();
    const recommendations: string[] = [];
    let canAutoStart = false;

    if (!status.isRunning) {
      recommendations.push('Start the Vosk server');
      recommendations.push('Check server logs for errors');
      
      // Check if we can provide auto-start capability
      if (typeof window !== 'undefined' && 'electron' in window) {
        canAutoStart = true;
        recommendations.push('Click "Auto-Start Server" to start automatically');
      } else {
        recommendations.push('Follow manual start instructions below');
      }
    }

    if (!status.isReachable && status.isRunning) {
      recommendations.push('Check firewall settings');
      recommendations.push('Verify port 2700 is not blocked');
      recommendations.push('Try restarting the server');
    }

    return {
      status,
      recommendations,
      canAutoStart
    };
  }
}

// Singleton instance
export const voskServerManager = new VoskServerManager();

// React hook for server status
export function useVoskServerStatus() {
  const [status, setStatus] = useState<VoskServerStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      // Reset failure count when user manually checks
      voskServerManager.resetFailureCount();
      const newStatus = await voskServerManager.checkServerStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error('❌ Failed to check server status:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up status monitoring with longer initial interval
    const handleStatusChange = (newStatus: VoskServerStatus) => {
      setStatus(newStatus);
    };

    voskServerManager.onStatusChange(handleStatusChange);
    voskServerManager.startMonitoring(30000); // Start with 30 seconds instead of 10 to reduce initial spam

    return () => {
      voskServerManager.removeStatusCallback(handleStatusChange);
      voskServerManager.stopMonitoring();
    };
  }, [checkStatus]);

  return {
    status,
    isChecking,
    checkStatus,
    manager: voskServerManager
  };
}

// Helper function to check if server is available
export async function isVoskServerAvailable(): Promise<boolean> {
  const status = await voskServerManager.checkServerStatus();
  return status.isRunning && status.isReachable;
}