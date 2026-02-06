#!/usr/bin/env python3
"""
Test script to verify silence detection and filtering in Vosk server.
This tests the audio processing pipeline to ensure silence is properly filtered.
"""

import numpy as np
import sys
import os

# Add VoskServer to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'VoskServer'))

# Import the audio processing functions from server.py
# We'll need to extract these functions for testing

def downsample_to_16k(audio_data: np.ndarray, source_rate: int) -> np.ndarray:
    """Downsample audio to 16kHz using high-quality resampling."""
    if source_rate == 16000:
        return audio_data
    
    target_rate = 16000
    ratio = source_rate / target_rate
    
    try:
        from scipy import signal
        new_length = int(len(audio_data) / ratio)
        downsampled = signal.resample(audio_data, new_length)
        return downsampled.astype(np.float32)
    except ImportError:
        new_length = int(len(audio_data) / ratio)
        indices = np.linspace(0, len(audio_data) - 1, new_length)
        downsampled = np.interp(indices, np.arange(len(audio_data)), audio_data)
        return downsampled.astype(np.float32)

def apply_high_pass_filter(audio_data: np.ndarray, sample_rate: int = 16000, cutoff: float = 80.0) -> np.ndarray:
    """Apply simple high-pass filter to remove low-frequency noise."""
    if len(audio_data) == 0:
        return audio_data
    
    rc = 1.0 / (cutoff * 2 * np.pi)
    dt = 1.0 / sample_rate
    alpha = rc / (rc + dt)
    
    filtered = np.zeros_like(audio_data)
    filtered[0] = audio_data[0]
    
    for i in range(1, len(audio_data)):
        filtered[i] = alpha * (filtered[i-1] + audio_data[i] - audio_data[i-1])
    
    return filtered

def apply_noise_gate(audio_data: np.ndarray, threshold: float = 0.015, attack: float = 0.001, release: float = 0.05) -> np.ndarray:
    """Apply noise gate with smooth attack/release."""
    if len(audio_data) == 0:
        return audio_data
    
    abs_audio = np.abs(audio_data)
    envelope = np.zeros_like(abs_audio)
    envelope[0] = abs_audio[0]
    
    for i in range(1, len(abs_audio)):
        if abs_audio[i] > envelope[i-1]:
            envelope[i] = abs_audio[i]
        else:
            envelope[i] = envelope[i-1] * 0.95 + abs_audio[i] * 0.05
    
    gate = np.where(envelope > threshold, 1.0, 0.0)
    gated_audio = audio_data * gate
    
    return gated_audio

def float32_to_pcm16(audio_data: np.ndarray) -> bytes:
    """Convert Float32 audio to PCM16 bytes with advanced noise filtering."""
    # Check if audio is mostly silence FIRST
    rms = np.sqrt(np.mean(audio_data ** 2))
    if rms < 0.12:
        print(f"   🔇 SILENCE DETECTED (RMS: {rms:.6f} < 0.12) - Returning silence")
        return np.zeros(len(audio_data), dtype=np.int16).tobytes()
    
    # Apply high-pass filter
    audio_data = apply_high_pass_filter(audio_data, sample_rate=16000, cutoff=80.0)
    
    # Apply noise gate
    audio_data = apply_noise_gate(audio_data, threshold=0.15, attack=0.001, release=0.05)
    
    # Check RMS again after filtering
    rms_after = np.sqrt(np.mean(audio_data ** 2))
    if rms_after < 0.08:
        print(f"   🔇 SILENCE AFTER FILTERING (RMS: {rms_after:.6f} < 0.08) - Returning silence")
        return np.zeros(len(audio_data), dtype=np.int16).tobytes()
    
    # Apply soft compression
    audio_data = np.tanh(audio_data * 1.2) * 0.9
    audio_data = np.clip(audio_data, -1.0, 1.0)
    
    # Convert to int16
    pcm16 = (audio_data * 32767).astype(np.int16)
    return pcm16.tobytes()

def test_silence_detection():
    """Test that silence is properly detected and filtered."""
    print("=" * 70)
    print("SILENCE DETECTION TEST")
    print("=" * 70)
    
    # Test 1: Pure silence (RMS = 0)
    print("\n[TEST 1] Pure Silence (RMS = 0)")
    print("-" * 70)
    silence = np.zeros(1600, dtype=np.float32)
    rms = np.sqrt(np.mean(silence ** 2))
    print(f"Input RMS: {rms:.6f}")
    result = float32_to_pcm16(silence)
    result_int16 = np.frombuffer(result, dtype=np.int16)
    max_amplitude = np.max(np.abs(result_int16))
    print(f"Output max amplitude: {max_amplitude}")
    print(f"✓ PASS" if max_amplitude == 0 else f"✗ FAIL - Expected 0, got {max_amplitude}")
    
    # Test 2: Very quiet noise (RMS = 0.002, like in the logs)
    print("\n[TEST 2] Very Quiet Noise (RMS = 0.002)")
    print("-" * 70)
    quiet_noise = np.random.normal(0, 0.002, 1600).astype(np.float32)
    rms = np.sqrt(np.mean(quiet_noise ** 2))
    print(f"Input RMS: {rms:.6f}")
    result = float32_to_pcm16(quiet_noise)
    result_int16 = np.frombuffer(result, dtype=np.int16)
    max_amplitude = np.max(np.abs(result_int16))
    print(f"Output max amplitude: {max_amplitude}")
    print(f"✓ PASS" if max_amplitude < 100 else f"✗ FAIL - Expected < 100, got {max_amplitude}")
    
    # Test 3: Moderate noise (RMS = 0.05)
    print("\n[TEST 3] Moderate Noise (RMS = 0.05)")
    print("-" * 70)
    moderate_noise = np.random.normal(0, 0.05, 1600).astype(np.float32)
    rms = np.sqrt(np.mean(moderate_noise ** 2))
    print(f"Input RMS: {rms:.6f}")
    result = float32_to_pcm16(moderate_noise)
    result_int16 = np.frombuffer(result, dtype=np.int16)
    max_amplitude = np.max(np.abs(result_int16))
    print(f"Output max amplitude: {max_amplitude}")
    print(f"✓ PASS" if max_amplitude < 100 else f"✗ FAIL - Expected < 100, got {max_amplitude}")
    
    # Test 4: Normal speech (RMS = 0.15)
    print("\n[TEST 4] Normal Speech (RMS = 0.15)")
    print("-" * 70)
    speech = np.random.normal(0, 0.15, 1600).astype(np.float32)
    rms = np.sqrt(np.mean(speech ** 2))
    print(f"Input RMS: {rms:.6f}")
    result = float32_to_pcm16(speech)
    result_int16 = np.frombuffer(result, dtype=np.int16)
    max_amplitude = np.max(np.abs(result_int16))
    print(f"Output max amplitude: {max_amplitude}")
    print(f"✓ PASS" if max_amplitude > 100 else f"✗ FAIL - Expected > 100, got {max_amplitude}")
    
    # Test 5: Loud speech (RMS = 0.3)
    print("\n[TEST 5] Loud Speech (RMS = 0.3)")
    print("-" * 70)
    loud_speech = np.random.normal(0, 0.3, 1600).astype(np.float32)
    rms = np.sqrt(np.mean(loud_speech ** 2))
    print(f"Input RMS: {rms:.6f}")
    result = float32_to_pcm16(loud_speech)
    result_int16 = np.frombuffer(result, dtype=np.int16)
    max_amplitude = np.max(np.abs(result_int16))
    print(f"Output max amplitude: {max_amplitude}")
    print(f"✓ PASS" if max_amplitude > 1000 else f"✗ FAIL - Expected > 1000, got {max_amplitude}")
    
    print("\n" + "=" * 70)
    print("SILENCE DETECTION TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    test_silence_detection()
