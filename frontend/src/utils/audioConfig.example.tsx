/**
 * Example: How to integrate audioConfig in ReadingSessionPage
 * 
 * This shows how to use the audio configuration system
 * to support low-end microphones.
 */

import React, { useState, useEffect } from 'react';
import {
  testMicrophoneAndRecommend,
  createOptimizedAudioStream,
  getAudioConfigForDevice,
  type AudioConfig
} from './audioConfig';

/**
 * Example 1: Test microphone and show recommendation
 */
export function MicrophoneTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const testMicrophone = async () => {
    setTesting(true);
    
    try {
      const result = await testMicrophoneAndRecommend();
      setResult(result);
      
      console.log('Microphone test results:', result);
      alert(result.recommendation);
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      alert('Failed to test microphone');
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div>
      <button onClick={testMicrophone} disabled={testing}>
        {testing ? 'Testing...' : 'Test Microphone'}
      </button>
      
      {result && (
        <div>
          <p>Quality: {result.quality}</p>
          <p>Average Volume: {result.averageVolume.toFixed(2)}</p>
          <p>Recommendation: {result.recommendation}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Create optimized audio stream
 */
export async function startOptimizedRecording(deviceId?: string) {
  try {
    // Test microphone first
    const { quality, recommendation } = await testMicrophoneAndRecommend(deviceId);
    
    console.log(`Microphone quality: ${quality}`);
    console.log(`Recommendation: ${recommendation}`);
    
    // Create optimized stream
    const { stream, audioContext, processedNode, config } = 
      await createOptimizedAudioStream(deviceId, quality);
    
    console.log(`Using config:`, config);
    console.log(`Sample rate: ${config.constraints.sampleRate}Hz`);
    console.log(`Gain: ${config.gainMultiplier}x`);
    
    // Create script processor for audio data
    const scriptNode = audioContext.createScriptProcessor(config.bufferSize, 1, 1);
    
    // Connect: processedNode -> scriptNode -> destination
    processedNode.connect(scriptNode);
    scriptNode.connect(audioContext.destination);
    
    // Process audio
    scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Convert to int16 for Vosk
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      
      // Send to Vosk
      // websocket.send(int16Data.buffer);
      
      console.log(`Audio chunk: ${int16Data.length} samples`);
    };
    
    return {
      stream,
      audioContext,
      scriptNode,
      quality,
      config
    };
    
  } catch (error) {
    console.error('Failed to start optimized recording:', error);
    throw error;
  }
}

/**
 * Example 3: Microphone selector with quality indicator
 */
export function MicrophoneSelector() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [deviceConfigs, setDeviceConfigs] = useState<Map<string, AudioConfig>>(new Map());
  
  useEffect(() => {
    // Load audio devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      
      // Get config for each device
      const configs = new Map();
      audioInputs.forEach(device => {
        const config = getAudioConfigForDevice(device);
        configs.set(device.deviceId, config);
      });
      setDeviceConfigs(configs);
    });
  }, []);
  
  return (
    <div>
      <h3>Select Microphone</h3>
      
      <select 
        value={selectedDevice} 
        onChange={(e) => setSelectedDevice(e.target.value)}
      >
        <option value="">Default</option>
        {devices.map(device => {
          const config = deviceConfigs.get(device.deviceId);
          const quality = config?.description || 'Unknown';
          
          return (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label} ({quality})
            </option>
          );
        })}
      </select>
      
      {selectedDevice && deviceConfigs.has(selectedDevice) && (
        <div>
          <p>Configuration: {deviceConfigs.get(selectedDevice)?.description}</p>
          <p>Gain: {deviceConfigs.get(selectedDevice)?.gainMultiplier}x</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Integration in ReadingSessionPage
 */
export function ReadingSessionWithOptimizedAudio() {
  const [isRecording, setIsRecording] = useState(false);
  const [micQuality, setMicQuality] = useState<'high' | 'mid' | 'low'>('mid');
  const [audioConfig, setAudioConfig] = useState<AudioConfig | null>(null);
  
  const startRecording = async () => {
    try {
      // Test and create optimized stream
      const result = await startOptimizedRecording();
      
      setMicQuality(result.quality);
      setAudioConfig(result.config);
      setIsRecording(true);
      
      console.log('Recording started with optimized settings');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };
  
  const stopRecording = () => {
    // Stop recording logic here
    setIsRecording(false);
    console.log('Recording stopped');
  };
  
  return (
    <div>
      <h2>Reading Session</h2>
      
      {/* Microphone quality indicator */}
      {audioConfig && (
        <div className={`mic-quality mic-quality-${micQuality}`}>
          <span>Microphone: {audioConfig.description}</span>
          <span>Gain: {audioConfig.gainMultiplier}x</span>
        </div>
      )}
      
      {/* Recording controls */}
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {/* Story content */}
      <div className="story-content">
        {/* Story words here */}
      </div>
    </div>
  );
}

/**
 * Example 5: Show audio level meter
 */
export function AudioLevelMeter({ audioContext, sourceNode }: {
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
}) {
  const [level, setLevel] = useState(0);
  
  useEffect(() => {
    // Create analyser
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    sourceNode.connect(analyser);
    
    // Monitor audio level
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setLevel(average);
      
      requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
    
    return () => {
      sourceNode.disconnect(analyser);
    };
  }, [audioContext, sourceNode]);
  
  return (
    <div className="audio-level-meter">
      <div className="level-bar" style={{ width: `${level}%` }} />
      <span>{level.toFixed(0)}%</span>
    </div>
  );
}

export default {
  MicrophoneTest,
  startOptimizedRecording,
  MicrophoneSelector,
  ReadingSessionWithOptimizedAudio,
  AudioLevelMeter
};
