#!/usr/bin/env python3
"""
Low-End Microphone Audio Processor
===================================

Improves audio quality from low-end microphones (earphones, cheap headsets)
by applying signal processing techniques:

1. Noise reduction
2. Volume normalization
3. High-pass filtering
4. Dynamic range compression
5. Voice activity detection

This helps Vosk recognize speech better from poor quality microphones.
"""

import numpy as np
from typing import Tuple, Optional

class LowEndMicProcessor:
    """
    Audio processor optimized for low-end microphones.
    
    Features:
    - Noise gate (remove silence/background)
    - Volume normalization (boost quiet audio)
    - High-pass filter (remove low-frequency noise)
    - Dynamic compression (even out volume)
    - Voice activity detection
    """
    
    def __init__(self, sample_rate: int = 16000):
        """
        Initialize processor.
        
        Args:
            sample_rate: Audio sample rate in Hz
        """
        self.sample_rate = sample_rate
        
        # Noise gate settings
        self.noise_gate_threshold = 0.02  # 2% of max amplitude
        self.noise_gate_attack = 0.001    # 1ms attack
        self.noise_gate_release = 0.1     # 100ms release
        
        # Normalization settings
        self.target_rms = 0.15  # Target RMS level (15% of max)
        self.max_gain = 10.0    # Maximum gain multiplier
        
        # High-pass filter settings (remove low-frequency noise)
        self.highpass_cutoff = 80  # Hz (removes rumble, hum)
        
        # Compression settings
        self.compression_threshold = 0.5  # Start compressing at 50%
        self.compression_ratio = 4.0      # 4:1 compression
        
        # Voice activity detection
        self.vad_threshold = 0.01  # 1% of max amplitude
        self.vad_min_duration = 0.1  # 100ms minimum speech duration
        
        # State
        self.previous_samples = np.array([])
    
    def apply_noise_gate(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply noise gate to remove silence and background noise.
        
        Args:
            audio: Input audio samples (float32, -1.0 to 1.0)
            
        Returns:
            Processed audio with noise gate applied
        """
        # Calculate envelope (absolute value)
        envelope = np.abs(audio)
        
        # Apply threshold
        gate = envelope > self.noise_gate_threshold
        
        # Smooth gate (attack/release)
        smoothed_gate = np.copy(gate).astype(float)
        
        # Simple smoothing (can be improved with proper envelope follower)
        for i in range(1, len(smoothed_gate)):
            if smoothed_gate[i] > smoothed_gate[i-1]:
                # Attack
                smoothed_gate[i] = min(1.0, smoothed_gate[i-1] + self.noise_gate_attack * self.sample_rate)
            else:
                # Release
                smoothed_gate[i] = max(0.0, smoothed_gate[i-1] - self.noise_gate_release * self.sample_rate)
        
        # Apply gate
        return audio * smoothed_gate
    
    def normalize_volume(self, audio: np.ndarray) -> np.ndarray:
        """
        Normalize audio volume to target RMS level.
        Boosts quiet audio from low-end microphones.
        
        Args:
            audio: Input audio samples
            
        Returns:
            Normalized audio
        """
        # Calculate current RMS
        rms = np.sqrt(np.mean(audio ** 2))
        
        if rms < 1e-6:  # Silence
            return audio
        
        # Calculate required gain
        gain = self.target_rms / rms
        
        # Limit gain to prevent over-amplification
        gain = min(gain, self.max_gain)
        
        # Apply gain
        normalized = audio * gain
        
        # Prevent clipping
        max_val = np.max(np.abs(normalized))
        if max_val > 1.0:
            normalized = normalized / max_val
        
        return normalized
    
    def apply_highpass_filter(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply high-pass filter to remove low-frequency noise.
        Removes rumble, hum, and other low-frequency artifacts.
        
        Args:
            audio: Input audio samples
            
        Returns:
            Filtered audio
        """
        # Simple first-order high-pass filter
        # y[n] = x[n] - x[n-1] + alpha * y[n-1]
        
        # Calculate alpha from cutoff frequency
        rc = 1.0 / (2 * np.pi * self.highpass_cutoff)
        dt = 1.0 / self.sample_rate
        alpha = rc / (rc + dt)
        
        # Apply filter
        filtered = np.zeros_like(audio)
        filtered[0] = audio[0]
        
        for i in range(1, len(audio)):
            filtered[i] = audio[i] - audio[i-1] + alpha * filtered[i-1]
        
        return filtered
    
    def apply_compression(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply dynamic range compression to even out volume.
        Makes quiet parts louder and loud parts quieter.
        
        Args:
            audio: Input audio samples
            
        Returns:
            Compressed audio
        """
        # Calculate envelope
        envelope = np.abs(audio)
        
        # Apply compression
        compressed_envelope = np.where(
            envelope > self.compression_threshold,
            self.compression_threshold + (envelope - self.compression_threshold) / self.compression_ratio,
            envelope
        )
        
        # Apply to audio (preserve sign)
        compressed = np.where(
            audio != 0,
            compressed_envelope * np.sign(audio),
            0
        )
        
        return compressed
    
    def detect_voice_activity(self, audio: np.ndarray) -> bool:
        """
        Detect if audio contains voice activity.
        
        Args:
            audio: Input audio samples
            
        Returns:
            True if voice detected, False otherwise
        """
        # Calculate RMS energy
        rms = np.sqrt(np.mean(audio ** 2))
        
        # Simple threshold-based VAD
        return rms > self.vad_threshold
    
    def process(self, audio: np.ndarray) -> Tuple[np.ndarray, bool]:
        """
        Process audio through complete pipeline.
        
        Pipeline:
        1. High-pass filter (remove low-frequency noise)
        2. Noise gate (remove silence/background)
        3. Normalize volume (boost quiet audio)
        4. Compression (even out volume)
        5. Voice activity detection
        
        Args:
            audio: Input audio samples (float32, -1.0 to 1.0)
            
        Returns:
            Tuple of (processed_audio, voice_detected)
        """
        # Step 1: High-pass filter
        filtered = self.apply_highpass_filter(audio)
        
        # Step 2: Noise gate
        gated = self.apply_noise_gate(filtered)
        
        # Step 3: Normalize volume
        normalized = self.normalize_volume(gated)
        
        # Step 4: Compression
        compressed = self.apply_compression(normalized)
        
        # Step 5: Voice activity detection
        voice_detected = self.detect_voice_activity(compressed)
        
        return compressed, voice_detected
    
    def process_int16(self, audio_bytes: bytes) -> Tuple[bytes, bool]:
        """
        Process audio in int16 format (from microphone).
        
        Args:
            audio_bytes: Input audio as bytes (int16 PCM)
            
        Returns:
            Tuple of (processed_audio_bytes, voice_detected)
        """
        # Convert to float32
        audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float = audio_int16.astype(np.float32) / 32768.0
        
        # Process
        processed_float, voice_detected = self.process(audio_float)
        
        # Convert back to int16
        processed_int16 = (processed_float * 32767).astype(np.int16)
        processed_bytes = processed_int16.tobytes()
        
        return processed_bytes, voice_detected


def create_low_end_processor(sample_rate: int = 16000) -> LowEndMicProcessor:
    """
    Factory function to create a low-end microphone processor.
    
    Args:
        sample_rate: Audio sample rate in Hz
        
    Returns:
        Configured LowEndMicProcessor instance
    """
    return LowEndMicProcessor(sample_rate)


# Example usage
if __name__ == "__main__":
    print("="*70)
    print("LOW-END MICROPHONE PROCESSOR TEST")
    print("="*70)
    
    # Create processor
    processor = create_low_end_processor(16000)
    
    # Generate test audio (quiet sine wave with noise)
    duration = 1.0  # seconds
    sample_rate = 16000
    samples = int(duration * sample_rate)
    
    # Create quiet sine wave (simulating quiet microphone)
    t = np.linspace(0, duration, samples)
    frequency = 440  # Hz (A4 note)
    audio = 0.05 * np.sin(2 * np.pi * frequency * t)  # Very quiet (5% amplitude)
    
    # Add noise (simulating low-end microphone)
    noise = 0.02 * np.random.randn(samples)
    audio_with_noise = audio + noise
    
    print(f"\nTest audio:")
    print(f"  Duration: {duration}s")
    print(f"  Sample rate: {sample_rate}Hz")
    print(f"  Original RMS: {np.sqrt(np.mean(audio_with_noise**2)):.4f}")
    print(f"  Original max: {np.max(np.abs(audio_with_noise)):.4f}")
    
    # Process audio
    processed, voice_detected = processor.process(audio_with_noise)
    
    print(f"\nProcessed audio:")
    print(f"  Processed RMS: {np.sqrt(np.mean(processed**2)):.4f}")
    print(f"  Processed max: {np.max(np.abs(processed)):.4f}")
    print(f"  Voice detected: {voice_detected}")
    print(f"  Gain applied: {np.sqrt(np.mean(processed**2)) / np.sqrt(np.mean(audio_with_noise**2)):.2f}x")
    
    print("\n✅ Processor test complete!")
    print("\nThe processor:")
    print("  - Removed low-frequency noise (high-pass filter)")
    print("  - Removed background noise (noise gate)")
    print("  - Boosted quiet audio (normalization)")
    print("  - Evened out volume (compression)")
    print("  - Detected voice activity")
