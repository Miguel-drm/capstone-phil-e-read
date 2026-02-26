/**
 * Audio Configuration for Different Microphone Types
 * ==================================================
 * 
 * Optimized settings for various microphone qualities:
 * - High-end (condenser mics, USB mics)
 * - Mid-range (laptop built-in, webcam mics)
 * - Low-end (earphone mics, cheap headsets)
 */

export interface AudioConstraints {
  channelCount: number;
  sampleRate: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  latency?: number;
  deviceId?: { exact: string };
}

export interface AudioConfig {
  constraints: AudioConstraints;
  bufferSize: number;
  gainMultiplier: number;
  description: string;
}

/**
 * High-end microphone configuration
 * For: Condenser mics, USB mics, professional equipment
 */
export const HIGH_END_CONFIG: AudioConfig = {
  constraints: {
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: false,  // High-end mics don't need it
    noiseSuppression: false,  // High-end mics have good signal
    autoGainControl: false,   // Manual control preferred
  },
  bufferSize: 4096,  // Larger buffer for quality
  gainMultiplier: 1.0,  // No boost needed
  description: "High-end microphone (condenser, USB)"
};

/**
 * Mid-range microphone configuration
 * For: Laptop built-in, webcam mics, standard headsets
 */
export const MID_RANGE_CONFIG: AudioConfig = {
  constraints: {
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: true,   // Enable for built-in mics
    noiseSuppression: true,   // Enable for background noise
    autoGainControl: true,    // Enable for consistent volume
  },
  bufferSize: 4096,
  gainMultiplier: 1.2,  // Slight boost
  description: "Mid-range microphone (laptop, webcam)"
};

/**
 * Low-end microphone configuration
 * For: Earphone mics, cheap headsets, phone mics
 * 
 * OPTIMIZED FOR:
 * - Quiet audio (needs amplification)
 * - High noise (needs suppression)
 * - Inconsistent volume (needs AGC)
 * - Poor frequency response
 */
export const LOW_END_CONFIG: AudioConfig = {
  constraints: {
    channelCount: 1,
    sampleRate: 16000,  // Lower sample rate for compatibility
    echoCancellation: true,   // CRITICAL: Remove echo
    noiseSuppression: true,   // CRITICAL: Remove background noise
    autoGainControl: true,    // CRITICAL: Boost quiet audio
  },
  bufferSize: 2048,  // Smaller buffer for faster processing
  gainMultiplier: 2.5,  // SIGNIFICANT boost for quiet mics
  description: "Low-end microphone (earphones, cheap headsets)"
};

/**
 * Fallback configuration (maximum compatibility)
 * For: When all else fails
 */
export const FALLBACK_CONFIG: AudioConfig = {
  constraints: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  bufferSize: 2048,
  gainMultiplier: 2.0,
  description: "Fallback (maximum compatibility)"
};

/**
 * Detect microphone quality based on device info
 */
export function detectMicrophoneQuality(device: MediaDeviceInfo): 'high' | 'mid' | 'low' {
  const label = device.label.toLowerCase();
  
  // High-end indicators
  if (
    label.includes('usb') ||
    label.includes('condenser') ||
    label.includes('blue') ||
    label.includes('rode') ||
    label.includes('shure') ||
    label.includes('audio-technica')
  ) {
    return 'high';
  }
  
  // Low-end indicators
  if (
    label.includes('earphone') ||
    label.includes('earbud') ||
    label.includes('headphone') ||
    label.includes('inline') ||
    label.includes('phone') ||
    label.includes('mobile') ||
    label.includes('cheap') ||
    label.includes('generic')
  ) {
    return 'low';
  }
  
  // Default to mid-range
  return 'mid';
}

/**
 * Get audio configuration based on microphone quality
 */
export function getAudioConfig(quality: 'high' | 'mid' | 'low'): AudioConfig {
  switch (quality) {
    case 'high':
      return HIGH_END_CONFIG;
    case 'mid':
      return MID_RANGE_CONFIG;
    case 'low':
      return LOW_END_CONFIG;
    default:
      return MID_RANGE_CONFIG;
  }
}

/**
 * Get audio configuration for specific device
 */
export function getAudioConfigForDevice(device: MediaDeviceInfo): AudioConfig {
  const quality = detectMicrophoneQuality(device);
  return getAudioConfig(quality);
}

/**
 * Apply audio processing for low-end microphones
 * 
 * This function applies additional processing to improve
 * audio quality from low-end microphones:
 * - Noise gate (remove silence/background)
 * - Compression (even out volume)
 * - High-pass filter (remove low-frequency noise)
 */
export function applyLowEndProcessing(
  audioContext: AudioContext,
  source: MediaStreamAudioSourceNode
): AudioNode {
  // Create processing chain
  const compressor = audioContext.createDynamicsCompressor();
  const highpass = audioContext.createBiquadFilter();
  const gainNode = audioContext.createGain();
  
  // Configure compressor (even out volume)
  compressor.threshold.value = -30;  // Start compressing at -30dB
  compressor.knee.value = 10;        // Smooth compression
  compressor.ratio.value = 8;        // 8:1 compression ratio
  compressor.attack.value = 0.003;   // Fast attack (3ms)
  compressor.release.value = 0.25;   // Medium release (250ms)
  
  // Configure high-pass filter (remove low-frequency noise)
  highpass.type = 'highpass';
  highpass.frequency.value = 80;  // Cut below 80Hz (removes rumble)
  highpass.Q.value = 1;
  
  // Configure gain (boost signal)
  gainNode.gain.value = 2.5;  // 2.5x boost for quiet mics
  
  // Connect processing chain
  source.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(gainNode);
  
  return gainNode;
}

/**
 * Test microphone and recommend configuration
 */
export async function testMicrophoneAndRecommend(
  deviceId?: string
): Promise<{
  quality: 'high' | 'mid' | 'low';
  config: AudioConfig;
  averageVolume: number;
  recommendation: string;
}> {
  try {
    // Get microphone stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    
    // Create audio context for analysis
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    source.connect(analyser);
    
    // Measure audio level for 2 seconds
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const samples: number[] = [];
    
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      samples.push(average);
    }
    
    // Calculate average volume
    const averageVolume = samples.reduce((a, b) => a + b) / samples.length;
    
    // Clean up
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();
    
    // Determine quality based on volume
    let quality: 'high' | 'mid' | 'low';
    let recommendation: string;
    
    if (averageVolume > 50) {
      quality = 'high';
      recommendation = "Good microphone quality detected. Using high-end settings.";
    } else if (averageVolume > 20) {
      quality = 'mid';
      recommendation = "Average microphone quality detected. Using mid-range settings.";
    } else {
      quality = 'low';
      recommendation = "Low microphone quality detected. Using optimized low-end settings with audio boost.";
    }
    
    const config = getAudioConfig(quality);
    
    return {
      quality,
      config,
      averageVolume,
      recommendation
    };
    
  } catch (error) {
    console.error("Error testing microphone:", error);
    
    // Return fallback config
    return {
      quality: 'low',
      config: FALLBACK_CONFIG,
      averageVolume: 0,
      recommendation: "Could not test microphone. Using fallback settings."
    };
  }
}

/**
 * Create optimized audio stream for low-end microphones
 */
export async function createOptimizedAudioStream(
  deviceId?: string,
  quality: 'high' | 'mid' | 'low' = 'mid'
): Promise<{
  stream: MediaStream;
  audioContext: AudioContext;
  processedNode: AudioNode;
  config: AudioConfig;
}> {
  const config = getAudioConfig(quality);
  
  // Add deviceId to constraints if provided
  const constraints = { ...config.constraints };
  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }
  
  // Try to get stream with optimal settings
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  } catch (error) {
    console.warn("Failed with optimal settings, trying fallback...", error);
    
    // Fallback to basic settings
    stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
  }
  
  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: config.constraints.sampleRate
  });
  
  // Resume if suspended
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  // Create source
  const source = audioContext.createMediaStreamSource(stream);
  
  // Apply processing for low-end mics
  let processedNode: AudioNode;
  if (quality === 'low') {
    processedNode = applyLowEndProcessing(audioContext, source);
  } else {
    // For high/mid-range, just use gain
    const gainNode = audioContext.createGain();
    gainNode.gain.value = config.gainMultiplier;
    source.connect(gainNode);
    processedNode = gainNode;
  }
  
  return {
    stream,
    audioContext,
    processedNode,
    config
  };
}

export default {
  HIGH_END_CONFIG,
  MID_RANGE_CONFIG,
  LOW_END_CONFIG,
  FALLBACK_CONFIG,
  detectMicrophoneQuality,
  getAudioConfig,
  getAudioConfigForDevice,
  applyLowEndProcessing,
  testMicrophoneAndRecommend,
  createOptimizedAudioStream
};
