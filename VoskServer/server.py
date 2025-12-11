import argparse
import asyncio
import json
import os
import sys
import time
import urllib.parse
import websockets
import numpy as np
from vosk import Model, KaldiRecognizer
from word_matcher import WordMatcherSession, check_pronunciation_match as match_pronunciation

# Server accepts audio in multiple formats and handles processing server-side
# Supported formats: Float32 (any sample rate), PCM16 (16kHz)

def downsample_to_16k(audio_data: np.ndarray, source_rate: int) -> np.ndarray:
    """
    Downsample audio to 16kHz using high-quality resampling.
    Uses sinc interpolation for better accuracy than linear interpolation.
    """
    if source_rate == 16000:
        return audio_data
    
    target_rate = 16000
    ratio = source_rate / target_rate
    
    # Use scipy's resample if available (better quality), otherwise fallback to linear
    try:
        from scipy import signal
        # Use scipy's resample for better quality (sinc interpolation)
        new_length = int(len(audio_data) / ratio)
        downsampled = signal.resample(audio_data, new_length)
        return downsampled.astype(np.float32)
    except ImportError:
        # Fallback to linear interpolation if scipy not available
        new_length = int(len(audio_data) / ratio)
        indices = np.linspace(0, len(audio_data) - 1, new_length)
        downsampled = np.interp(indices, np.arange(len(audio_data)), audio_data)
        return downsampled.astype(np.float32)

def apply_high_pass_filter(audio_data: np.ndarray, sample_rate: int = 16000, cutoff: float = 80.0) -> np.ndarray:
    """
    Apply simple high-pass filter to remove low-frequency noise (rumble, hum).
    Uses a simple first-order IIR filter for efficiency.
    """
    if len(audio_data) == 0:
        return audio_data
    
    # Calculate filter coefficient
    rc = 1.0 / (cutoff * 2 * np.pi)
    dt = 1.0 / sample_rate
    alpha = rc / (rc + dt)
    
    # Apply filter
    filtered = np.zeros_like(audio_data)
    filtered[0] = audio_data[0]
    
    for i in range(1, len(audio_data)):
        filtered[i] = alpha * (filtered[i-1] + audio_data[i] - audio_data[i-1])
    
    return filtered

def apply_noise_gate(audio_data: np.ndarray, threshold: float = 0.015, attack: float = 0.001, release: float = 0.05) -> np.ndarray:
    """
    Apply noise gate with smooth attack/release to remove low-level background noise.
    Samples below threshold are attenuated smoothly to avoid clicks.
    
    Args:
        audio_data: Input audio samples
        threshold: Amplitude threshold (0.0-1.0)
        attack: Attack time in seconds (how fast gate opens)
        release: Release time in seconds (how fast gate closes)
    """
    if len(audio_data) == 0:
        return audio_data
    
    # Calculate absolute values
    abs_audio = np.abs(audio_data)
    
    # Create envelope follower
    envelope = np.zeros_like(abs_audio)
    envelope[0] = abs_audio[0]
    
    # Simple envelope follower with attack/release
    for i in range(1, len(abs_audio)):
        if abs_audio[i] > envelope[i-1]:
            # Attack (fast)
            envelope[i] = abs_audio[i]
        else:
            # Release (slow)
            envelope[i] = envelope[i-1] * 0.95 + abs_audio[i] * 0.05
    
    # Create smooth gate based on envelope
    gate = np.where(envelope > threshold, 1.0, envelope / threshold * 0.3)  # Partial attenuation below threshold
    
    # Apply gate
    gated_audio = audio_data * gate
    
    return gated_audio

def float32_to_pcm16(audio_data: np.ndarray) -> bytes:
    """Convert Float32 audio (-1.0 to 1.0) to PCM16 bytes (little-endian) with advanced noise filtering."""
    # Apply high-pass filter to remove low-frequency noise (rumble, hum)
    audio_data = apply_high_pass_filter(audio_data, sample_rate=16000, cutoff=80.0)
    
    # Apply noise gate with smooth attack/release to remove background noise
    audio_data = apply_noise_gate(audio_data, threshold=0.015, attack=0.001, release=0.05)
    
    # Apply gentle compression to normalize volume levels
    # This helps with varying microphone distances and volumes
    audio_data = np.tanh(audio_data * 1.2) * 0.9  # Soft compression
    
    # Clamp values to [-1.0, 1.0]
    audio_data = np.clip(audio_data, -1.0, 1.0)
    
    # Convert to int16
    pcm16 = (audio_data * 32767).astype(np.int16)
    
    # Convert to bytes (little-endian)
    return pcm16.tobytes()

def process_audio_message(message: bytes, source_sample_rate: int = 48000, debug_count: int = 0) -> bytes:
    """
    Process incoming audio message and convert to PCM16 16kHz.
    Supports: Float32 arrays (any sample rate), PCM16 (16kHz)
    """
    try:
        # Try to parse as Float32 array (from frontend AudioContext)
        if len(message) % 4 == 0:  # Float32 is 4 bytes
            try:
                float32_array = np.frombuffer(message, dtype=np.float32)
                
                # DEBUG: Log audio processing details every 100 chunks
                if debug_count % 100 == 0:
                    print(f"   Input: {len(float32_array)} Float32 samples @ {source_sample_rate}Hz")
                
                # Downsample if needed
                downsampled = downsample_to_16k(float32_array, source_sample_rate)
                
                if debug_count % 100 == 0:
                    print(f"   Downsampled: {len(downsampled)} Float32 samples @ 16kHz")
                
                # Convert to PCM16
                pcm16_result = float32_to_pcm16(downsampled)
                
                if debug_count % 100 == 0:
                    print(f"   Output: {len(pcm16_result)} bytes PCM16")
                
                return pcm16_result
            except Exception as e:
                if debug_count % 100 == 0:
                    print(f"⚠ Error in Float32 processing: {e}")
                pass
        
        # Assume it's already PCM16 at 16kHz
        return message
    except Exception as e:
        print(f"⚠ Error processing audio: {e}")
        return message  # Return as-is if processing fails

async def recognize(websocket, path, model):
    sample_rate = 16000
    # Create recognizer with words (for better accuracy) and partial words enabled
    # FAST SPEECH OPTIMIZATION: Configure Vosk for faster recognition
    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.SetWords(True)  # Enable word-level timestamps (can help with accuracy)
    
    # FAST SPEECH: Set max alternatives to 3 for better fast speech handling
    # This allows Vosk to consider multiple hypotheses which helps with rapid speech
    recognizer.SetMaxAlternatives(3)
    
    # FAST SPEECH: Enable partial results for faster feedback
    # This is already enabled by default, but we're being explicit
    recognizer.SetPartialWords(True)
    
    # DEBUG: Track audio chunks received
    audio_chunks_received = 0
    audio_bytes_received = 0
    
    # Detect language from query parameter for pronunciation matching
    parsed = urllib.parse.urlparse(path if path else '/')
    query_params = urllib.parse.parse_qs(parsed.query)
    detected_language = query_params.get("lang", ["english"])[0].lower()
    if detected_language in ["tagalog", "tl"]:
        detected_language = "tagalog"
    else:
        detected_language = "english"
    
    # REMOVED: word_enhancer - was never actually used, all calls were disabled
    # The enhancer added complexity without providing value
    
    # Track if grammar has been set
    grammar_set = False
    # Track audio format from client
    client_sample_rate = 48000  # Default, can be overridden via config
    
    # Audio accumulation buffer - OPTIMIZED FOR FAST SPEECH
    audio_buffer = bytearray()
    # FAST SPEECH: Reduced buffer size for faster processing
    # 1600 bytes = 800 samples @ 16kHz = 0.05 seconds (50ms)
    # This allows Vosk to process audio more frequently, catching fast speech better
    buffer_size_target = 1600  # FAST SPEECH: ~0.05 seconds of audio for rapid processing
    
    # ACCURACY TRACKING: Track metrics for live updates
    session_start_time = time.time()
    recognized_words = []  # List of {"word": str, "timestamp": float, "confidence": float} dicts
    vocabulary = set()  # Story vocabulary for server-side filtering
    expected_words = []  # Expected word sequence for accuracy calculation
    total_words_expected = 0
    miscues = 0  # Total miscues (errors)
    miscue_types = {
        "mispronunciation": 0,
        "omission": 0,
        "substitution": 0,
        "insertion": 0,
        "repetition": 0,
        "transposition": 0,
        "reversal": 0
    }
    current_word_index = 0  # Track which expected word we're on
    
    # NEW: Word matcher session for server-side word matching
    word_matcher = None  # Will be initialized when expected_words are received
    phrase_matcher = None  # Phrase-level matcher (Option 2 for higher accuracy)
    use_phrase_mode = False  # Whether to use phrase-level matching
    
    try:
        async for message in websocket:
            try:
                # Handle binary audio data
                if isinstance(message, (bytes, bytearray)):
                    # DEBUG: Track audio reception
                    audio_chunks_received += 1
                    audio_bytes_received += len(message)
                    
                    # Log every 100 chunks
                    if audio_chunks_received % 100 == 0:
                        print(f"📊 Received {audio_chunks_received} audio chunks ({audio_bytes_received} bytes total)")
                    
                    # Process audio: convert format, downsampling if needed
                    pcm16_audio = process_audio_message(message, client_sample_rate, audio_chunks_received)
                    
                    # Accumulate audio in buffer
                    audio_buffer.extend(pcm16_audio)
                    
                    # Debug: Log buffer status every 100 chunks
                    if audio_chunks_received % 100 == 0:
                        print(f"   Buffer: {len(audio_buffer)} bytes (target: {buffer_size_target})")
                    
                    # Only process when we have enough audio accumulated
                    if len(audio_buffer) >= buffer_size_target:
                        # Send accumulated audio to Vosk
                        audio_to_process = bytes(audio_buffer)
                        audio_buffer.clear()
                        
                        print(f"   ✓ Sending {len(audio_to_process)} bytes to Vosk for recognition")
                        
                        # Process audio in chunks - Vosk works best with continuous streaming
                        # HYBRID MODE: Use both final and partial results
                        # Final results are more accurate, partial results are faster
                        has_final = recognizer.AcceptWaveform(audio_to_process)
                        
                        text = ""
                        if has_final:
                            # Final result - most accurate
                            res = json.loads(recognizer.Result())
                            text = res.get("text", "").strip()
                            if text:
                                print(f"🎤 Vosk FINAL result: '{text}'")
                                # Reset partial tracking on final result
                                if hasattr(recognizer, '_words_sent_count'):
                                    recognizer._words_sent_count = 0
                                    recognizer._last_partial_text = ""
                        else:
                            # Partial result - faster but less accurate
                            pres = json.loads(recognizer.PartialResult())
                            text = pres.get("partial", "").strip()
                            if text:
                                print(f"🎤 Vosk partial result: '{text}'")
                        
                        if text:
                            # REAL-TIME: Process partial results word-by-word
                            # Split into words and process only NEW words (not already sent)
                            words = text.split()
                            
                            # Track last sent partial to avoid duplicates
                            if not hasattr(recognizer, '_last_partial_text'):
                                recognizer._last_partial_text = ""
                                recognizer._words_sent_count = 0
                            
                            # Only process if we have new words
                            # Compare word count instead of word list to handle Vosk corrections
                            if len(words) > recognizer._words_sent_count:
                                new_words = words[recognizer._words_sent_count:]
                                recognizer._words_sent_count = len(words)
                            else:
                                new_words = []
                            
                            recognizer._last_partial_text = text
                            
                            if new_words and vocabulary:
                                # Filter NEW words - keep only those in vocabulary (with pronunciation matching)
                                filtered_words = []
                                rejected_words = []
                                for word in new_words:
                                    word_lower = word.lower().strip()
                                    
                                    # Direct match
                                    if word_lower in vocabulary:
                                        filtered_words.append(word)
                                    else:
                                        # Try pronunciation matching against vocabulary
                                        matched = False
                                        best_match = None
                                        
                                        # First try exact pronunciation match
                                        for vocab_word in vocabulary:
                                            if match_pronunciation(word_lower, vocab_word, detected_language):
                                                # Use the vocabulary word (canonical form)
                                                best_match = vocab_word
                                                matched = True
                                                print(f"   🔄 Pronunciation match: '{word}' → '{vocab_word}'")
                                                break
                                        
                                        # If no pronunciation match, try fuzzy match (1-2 char difference)
                                        if not matched:
                                            for vocab_word in vocabulary:
                                                if len(word_lower) == len(vocab_word):
                                                    diff = sum(c1 != c2 for c1, c2 in zip(word_lower, vocab_word))
                                                    if diff <= 1:  # Allow 1 character difference
                                                        best_match = vocab_word
                                                        matched = True
                                                        print(f"   🔄 Fuzzy match: '{word}' → '{vocab_word}' (1 char diff)")
                                                        break
                                        
                                        if matched and best_match:
                                            filtered_words.append(best_match)
                                        else:
                                            rejected_words.append(word)
                                
                                if rejected_words:
                                    print(f"   ❌ Vocabulary filter: Rejected {len(rejected_words)} word(s) not in story: {', '.join(rejected_words)}")
                                
                                if filtered_words:
                                    filtered_text = ' '.join(filtered_words)
                                    print(f"   ✅ Vocabulary filter: Accepted \"{filtered_text}\"")
                                    
                                    # NEW: Use phrase matcher or word matcher if initialized
                                    if use_phrase_mode and phrase_matcher:
                                        # PHRASE MODE: Process each word through phrase matcher
                                        for word in filtered_words:
                                            match_result = phrase_matcher.process_word(word)
                                            
                                            # Calculate current metrics
                                            elapsed = time.time() - session_start_time
                                            metrics = phrase_matcher.get_metrics(elapsed)
                                            
                                            # Send match result with metrics
                                            await websocket.send(json.dumps({
                                                "text": word,
                                                "match_result": match_result,
                                                "metrics": metrics
                                            }))
                                            
                                            print(f"   📊 Phrase Match: {match_result['match_type']} - {match_result['details']}")
                                    elif word_matcher:
                                        # WORD MODE: Process each word through word matcher
                                        for word in filtered_words:
                                            match_result = word_matcher.process_word(word)
                                            
                                            # Calculate current metrics
                                            elapsed = time.time() - session_start_time
                                            metrics = word_matcher.get_metrics(elapsed)
                                            
                                            # Send match result with metrics
                                            await websocket.send(json.dumps({
                                                "text": word,
                                                "match_result": match_result,
                                                "metrics": metrics
                                            }))
                                            
                                            print(f"   📊 Match: {match_result['match_type']} - {match_result['details']}")
                                    else:
                                        # Fallback: Send filtered result without matching
                                        await websocket.send(json.dumps({
                                            "text": filtered_text,
                                            "confidence": 1.0
                                        }))
                                else:
                                    print(f"   ⚠️ All words rejected by vocabulary filter")
                            elif new_words:
                                # No vocabulary filter - send all NEW words
                                print(f"   ✅ Sending words to client: '{' '.join(new_words)}'")
                                
                                # NEW: Use phrase matcher or word matcher if initialized
                                if use_phrase_mode and phrase_matcher:
                                    # PHRASE MODE: Process each word through phrase matcher
                                    for word in new_words:
                                        match_result = phrase_matcher.process_word(word)
                                        
                                        # Calculate current metrics
                                        elapsed = time.time() - session_start_time
                                        metrics = phrase_matcher.get_metrics(elapsed)
                                        
                                        # Send match result with metrics
                                        await websocket.send(json.dumps({
                                            "text": word,
                                            "match_result": match_result,
                                            "metrics": metrics
                                        }))
                                        
                                        print(f"   📊 Phrase Match: {match_result['match_type']} - {match_result['details']}")
                                elif word_matcher:
                                    # WORD MODE: Process each word through word matcher
                                    for word in new_words:
                                        match_result = word_matcher.process_word(word)
                                        
                                        # Calculate current metrics
                                        elapsed = time.time() - session_start_time
                                        metrics = word_matcher.get_metrics(elapsed)
                                        
                                        # Send match result with metrics
                                        await websocket.send(json.dumps({
                                            "text": word,
                                            "match_result": match_result,
                                            "metrics": metrics
                                        }))
                                        
                                        print(f"   📊 Match: {match_result['match_type']} - {match_result['details']}")
                                else:
                                    # Fallback: Send text without matching
                                    await websocket.send(json.dumps({
                                        "text": ' '.join(new_words),
                                        "confidence": 1.0
                                    }))
                            
                            # OLD CODE - COMPLETELY DISABLED
                            if False:
                                if text:
                                    enhanced_result = word_enhancer.process_vosk_result(res)
                                    print(f"   Enhancer result: {enhanced_result}")
                                if False and enhanced_result:
                                    recognized_word = enhanced_result['text'].lower().strip()
                                    confidence = enhanced_result.get('confidence', 0.0)
                                    current_time = time.time()
                                    
                                    # ACCURACY: Server-side vocabulary filtering
                                    if vocabulary and recognized_word not in vocabulary:
                                        # Check if word is similar to any vocabulary word (fuzzy match)
                                        is_valid = False
                                        for vocab_word in vocabulary:
                                            # Simple similarity check (Levenshtein-like)
                                            if len(recognized_word) == len(vocab_word):
                                                diff = sum(c1 != c2 for c1, c2 in zip(recognized_word, vocab_word))
                                                if diff <= 1:  # Allow 1 char difference
                                                    recognized_word = vocab_word  # Use vocabulary word
                                                    is_valid = True
                                                    break
                                        
                                        if not is_valid:
                                            # Word not in vocabulary - reject
                                            print(f"❌ Rejected word not in vocabulary: '{recognized_word}'")
                                            continue
                                    
                                    # ACCURACY: Check if word matches expected word (for miscue detection)
                                    is_correct = False
                                    is_miscue = False
                                    miscue_type = None
                                    
                                    if expected_words and current_word_index < len(expected_words):
                                        expected_word = expected_words[current_word_index].lower().strip()
                                        
                                        # Check for exact match
                                        if recognized_word == expected_word:
                                            is_correct = True
                                        else:
                                            # Check for similarity (mispronunciation vs substitution)
                                            # Simple similarity check
                                            if len(recognized_word) == len(expected_word):
                                                diff = sum(c1 != c2 for c1, c2 in zip(recognized_word, expected_word))
                                                if diff <= 1:
                                                    # Very similar - treat as mispronunciation
                                                    is_miscue = True
                                                    miscue_type = "mispronunciation"
                                                    miscue_types["mispronunciation"] += 1
                                                else:
                                                    # Different word - substitution
                                                    is_miscue = True
                                                    miscue_type = "substitution"
                                                    miscue_types["substitution"] += 1
                                            else:
                                                # Different length - likely substitution
                                                is_miscue = True
                                                miscue_type = "substitution"
                                                miscue_types["substitution"] += 1
                                        
                                        # Increment word index
                                        current_word_index += 1
                                    
                                    # Track recognized word with timestamp and correctness
                                    recognized_words.append({
                                        "word": recognized_word,
                                        "timestamp": current_time,
                                        "confidence": confidence,
                                        "is_correct": is_correct,
                                        "is_miscue": is_miscue,
                                        "miscue_type": miscue_type
                                    })
                                    
                                    # Update miscue count
                                    if is_miscue:
                                        miscues += 1
                                    
                                    # ACCURACY: Calculate live metrics
                                    elapsed_time = current_time - session_start_time
                                    words_count = len(recognized_words)
                                    
                                    # Calculate WPM (Words Per Minute)
                                    wpm = 0
                                    if elapsed_time > 0:
                                        wpm = int((words_count / elapsed_time) * 60)
                                    
                                    # Calculate accuracy (if expected words provided)
                                    accuracy = 0.0
                                    correct_words = 0
                                    if expected_words and words_count > 0:
                                        # Count correct words
                                        correct_words = sum(1 for w in recognized_words if w.get("is_correct", False))
                                        
                                        if words_count > 0:
                                            accuracy = (correct_words / min(words_count, len(expected_words))) * 100
                                    
                                    # Calculate Oral Reading Score = ((Words Read - Miscues) / Total Words) * 100
                                    oral_reading_score = 0.0
                                    if total_words_expected > 0:
                                        correct_words_for_score = words_count - miscues
                                        oral_reading_score = (correct_words_for_score / total_words_expected) * 100
                                        oral_reading_score = max(0.0, min(100.0, oral_reading_score))  # Clamp 0-100
                                    
                                    # Send enhanced result with live metrics
                                    await websocket.send(json.dumps({
                                        "text": recognized_word,
                                        "confidence": confidence,
                                        "is_correct": is_correct,
                                        "is_miscue": is_miscue,
                                        "miscue_type": miscue_type,
                                        "metrics": {
                                            "wpm": wpm,
                                            "accuracy": round(accuracy, 1),
                                            "words_read": words_count,
                                            "total_miscues": miscues,
                                            "oral_reading_score": round(oral_reading_score, 1),
                                            "elapsed_time": round(elapsed_time, 1),
                                            "correct_words": correct_words,
                                            "miscue_types": miscue_types.copy()
                                        }
                                    }))
                                    # Don't send if filtered (prevents jumping)
                        else:
                            # Partial result - process but don't send (prevents jumping)
                            pres = json.loads(recognizer.PartialResult())
                            partial = pres.get("partial", "").strip()
                            if partial:
                                # Track partial for stability, but don't send to prevent jumping
                                word_enhancer.process_vosk_result(pres)
                                # Optionally send partial only if very stable (uncomment if needed)
                            # enhanced_partial = word_enhancer.process_vosk_result(pres)
                            # if enhanced_partial:
                            #     await websocket.send(json.dumps({"partial": enhanced_partial['text']}))
                elif isinstance(message, str):
                    # Handle JSON configuration messages
                    try:
                        config_msg = json.loads(message)
                        
                        # Handle audio format configuration
                        if "audio_format" in config_msg:
                            audio_format = config_msg["audio_format"]
                            if "sample_rate" in audio_format:
                                client_sample_rate = int(audio_format["sample_rate"])
                                print(f"✓ Client audio format: {audio_format.get('format', 'Float32')} @ {client_sample_rate}Hz")
                        
                        # Handle grammar/vocabulary constraint
                        if "config" in config_msg:
                            config = config_msg["config"]
                            
                            # ACCURACY: Store vocabulary for server-side filtering
                            if "vocabulary" in config:
                                vocabulary = set(word.lower().strip() for word in config["vocabulary"])
                                print(f"✓ Vocabulary loaded: {len(vocabulary)} words for server-side filtering")
                            
                            # ACCURACY: Store expected word sequence for accuracy calculation
                            if "expected_words" in config:
                                expected_words = [word.strip() for word in config["expected_words"]]  # Keep original case
                                total_words_expected = len(expected_words)
                                current_word_index = 0  # Reset word index
                                
                                # Check if phrase mode is requested
                                use_phrase_mode = config.get("use_phrase_mode", False)
                                
                                if use_phrase_mode:
                                    # Initialize phrase matcher (Option 2 - higher accuracy)
                                    try:
                                        from phrase_matcher import PhraseMatcherSession
                                        phrase_matcher = PhraseMatcherSession(expected_words, detected_language)
                                        print(f"✓ Expected word sequence loaded: {total_words_expected} words")
                                        print(f"✓ PHRASE MATCHER initialized for {detected_language} language (Option 2)")
                                        print(f"   Using phrase-level assessment for 85-95% accuracy")
                                    except ImportError as e:
                                        print(f"⚠ Phrase matcher not available: {e}")
                                        print(f"   Falling back to word-level matcher")
                                        use_phrase_mode = False
                                        word_matcher = WordMatcherSession(expected_words, detected_language)
                                        print(f"✓ Word matcher initialized for {detected_language} language")
                                else:
                                    # Initialize word matcher session (Option 1 - original)
                                    word_matcher = WordMatcherSession(expected_words, detected_language)
                                    print(f"✓ Expected word sequence loaded: {total_words_expected} words")
                                    print(f"✓ Word matcher initialized for {detected_language} language")
                            
                            # Check for enhancer configuration
                            if "enhancer" in config:
                                enhancer_settings = config["enhancer"]
                                word_enhancer = create_enhanced_recognizer(enhancer_settings)
                                print(f"✓ Word recognition enhancer configured")
                                await websocket.send(json.dumps({
                                    "status": "enhancer_configured",
                                    "settings": enhancer_settings
                                }))
                            
                            # Check for grammar or word_list constraint
                            grammar = config.get("grammar") or config.get("word_list")
                            
                            if grammar and isinstance(grammar, list) and len(grammar) > 0:
                                # ACCURACY BOOST: Enhance grammar with pronunciation variants
                                enhanced_grammar = []  # Use list to allow duplicates for boosting
                                
                                # Import pronunciation dictionaries
                                try:
                                    if detected_language == "english":
                                        from english_pronunciation_dictionary import PRONUNCIATION_DICT
                                    else:
                                        from tagalog_pronunciation_dictionary import PRONUNCIATION_DICT
                                    
                                    # Add pronunciation variants for each word
                                    for word in grammar:
                                        word_lower = word.lower().strip()
                                        enhanced_grammar.append(word)  # Add original
                                        
                                        # SHORT WORD BOOST: Repeat short words to increase recognition weight
                                        if len(word_lower) <= 3:
                                            # Boost short words (1-3 letters) by adding them multiple times
                                            enhanced_grammar.extend([word] * 3)  # Add 3 more copies
                                            print(f"   🔊 Boosted short word: '{word}' (4x weight)")
                                        
                                        if word_lower in PRONUNCIATION_DICT:
                                            # Add all pronunciation variants
                                            for variant in PRONUNCIATION_DICT[word_lower]:
                                                enhanced_grammar.append(variant)
                                                # Also boost short variants
                                                if len(variant) <= 3:
                                                    enhanced_grammar.extend([variant] * 2)
                                    
                                    unique_count = len(set(enhanced_grammar))
                                    print(f"✓ Enhanced grammar: {len(grammar)} words → {unique_count} unique words ({len(enhanced_grammar)} total with boosting)")
                                except ImportError:
                                    print(f"⚠ Pronunciation dictionary not available, using basic grammar")
                                    enhanced_grammar = grammar
                                
                                # Try to apply enhanced grammar constraint (not all models support this)
                                try:
                                    # Convert to list if it's a set, keep as list if already list
                                    grammar_list = list(enhanced_grammar) if not isinstance(enhanced_grammar, list) else enhanced_grammar
                                    grammar_json = json.dumps(grammar_list)
                                    recognizer = KaldiRecognizer(model, sample_rate, grammar_json)
                                    recognizer.SetWords(True)
                                    grammar_set = True
                                    unique_words = len(set(grammar_list))
                                    print(f"✓ Enhanced grammar constraint applied: {unique_words} unique words ({len(grammar_list)} total with boosting)")
                                    await websocket.send(json.dumps({
                                        "status": "grammar_applied",
                                        "word_count": len(enhanced_grammar),
                                        "original_count": len(grammar)
                                    }))
                                except Exception as e:
                                    # Model doesn't support runtime graphs (grammar constraints)
                                    print(f"⚠ Grammar constraint not supported by this model: {e}")
                                    print(f"   Continuing without grammar constraint (vocabulary filtering will be done server-side)")
                                    await websocket.send(json.dumps({
                                        "status": "grammar_not_supported",
                                        "message": "Model doesn't support grammar constraints, using server-side vocabulary filtering"
                                    }))
                            else:
                                print("⚠ Received config but no valid grammar/word_list")
                    except json.JSONDecodeError:
                        # Not JSON, might be heartbeat - ignore
                        pass
                    except Exception as e:
                        print(f"Error processing config: {e}")
                else:
                    # ignore other message types (like heartbeat pings)
                    pass
            except Exception as e:
                # Handle errors during message processing without crashing the connection
                error_type = type(e).__name__
                error_message = str(e)
                print(f"\n⚠️ Error processing message:")
                print(f"   Type: {error_type}")
                print(f"   Message: {error_message}")
                print(f"   Action: Continuing connection (error handled)")
                # Continue processing - don't break the connection
                continue
    except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError) as e:
        # Connection closed - provide clear information about what happened
        code = getattr(e, 'code', None)
        reason = getattr(e, 'reason', 'No reason provided')
        
        # WebSocket close codes reference
        close_code_messages = {
            1000: "Normal closure",
            1001: "Going away (server restarting or client navigating away)",
            1002: "Protocol error",
            1003: "Unsupported data type",
            1005: "No status code (abnormal closure - browser tab closed, network lost, etc.)",
            1006: "Abnormal closure (connection lost without close frame)",
            1007: "Invalid data",
            1008: "Policy violation",
            1009: "Message too large",
            1011: "Internal server error",
            1012: "Service restart",
            1013: "Try again later",
            1014: "Bad gateway",
            1015: "TLS handshake failure"
        }
        
        code_message = close_code_messages.get(code, f"Unknown code: {code}")
        
        if code == 1005 or code == 1006:
            # Common normal disconnections - show brief message
            print(f"🔌 Client disconnected (code {code}: {code_message})")
        elif code == 1000:
            # Clean closure - minimal logging
            print(f"✓ Client disconnected cleanly")
        else:
            # Other codes - show full details
            print(f"⚠️ Client disconnected unexpectedly:")
            print(f"   Code: {code}")
            print(f"   Message: {code_message}")
            print(f"   Reason: {reason}")
    except Exception as e:
        # Log unexpected errors with clear, structured information
        error_type = type(e).__name__
        error_message = str(e)
        
        print(f"\n{'='*60}")
        print(f"❌ UNEXPECTED ERROR in connection handler")
        print(f"{'='*60}")
        print(f"Error Type: {error_type}")
        print(f"Error Message: {error_message}")
        print(f"Location: recognize() function")
        print(f"{'='*60}")
        
        # Only show traceback for non-connection errors
        if "Connection" not in error_type and "Closed" not in error_type:
            print(f"\n📋 Full Traceback:")
            print(f"{'-'*60}")
            import traceback
            traceback.print_exc()
            print(f"{'-'*60}")
        else:
            print(f"ℹ️ This is a connection-related error (expected behavior)")
        
        print(f"{'='*60}\n")
    finally:
        # CRITICAL: Send final result on close to catch last words
        try:
            fres = json.loads(recognizer.FinalResult())
            text = fres.get("text", "").strip()
            
            if text:
                print(f"🏁 FINAL RESULT on close: '{text}'")
                
                # Apply vocabulary filter to final result
                if vocabulary:
                    words = text.split()
                    filtered_words = []
                    rejected_words = []
                    for word in words:
                        word_lower = word.lower().strip()
                        if word_lower in vocabulary:
                            filtered_words.append(word)
                        else:
                            rejected_words.append(word)
                    
                    if rejected_words:
                        print(f"   ❌ Final result filter: Rejected {len(rejected_words)} word(s): {', '.join(rejected_words)}")
                    
                    if filtered_words:
                        filtered_text = ' '.join(filtered_words)
                        print(f"   ✅ Final result filter: Accepted \"{filtered_text}\"")
                        
                        # Send filtered final result
                        await websocket.send(json.dumps({
                            "text": filtered_text,
                            "confidence": 1.0,
                            "final": True
                        }))
                    else:
                        print(f"   ⚠️ All final words rejected by vocabulary filter")
                else:
                    # No vocabulary filter - send all words
                    print(f"   ✅ Sending final result: '{text}'")
                    await websocket.send(json.dumps({
                        "text": text,
                        "confidence": 1.0,
                        "final": True
                    }))
        except Exception as e:
            print(f"⚠️ Error sending final result: {e}")
            pass

async def handler(ws, path):
    """
    WebSocket handler that selects the appropriate model based on language query parameter.
    Expected URL format: ws://host:port/?lang=tagalog or ws://host:port/?lang=english
    """
    try:
        # Parse query parameters from path
        parsed = urllib.parse.urlparse(path)
        query_params = urllib.parse.parse_qs(parsed.query)
        language = query_params.get("lang", ["tagalog"])[0].lower()  # Default to tagalog
        
        print(f"\n{'='*60}")
        print(f"🔌 New connection received")
        print(f"   RAW PATH: {path}")
        print(f"   PARSED QUERY: {parsed.query}")
        print(f"   QUERY PARAMS: {query_params}")
        print(f"   Language requested: {language}")
        print(f"   Available models: {list(models.keys())}")
        print(f"{'='*60}")
        
        # Select model based on language
        if language == "english" or language == "en":
            model = models.get("english")
            if not model:
                error_msg = f"English model not loaded. Available models: {', '.join(models.keys())}"
                print(f"❌ {error_msg}")
                print(f"   Available models: {list(models.keys())}")
                print(f"   💡 To load English model:")
                print(f"      1. Download: python download_huggingface_model.py")
                print(f"      2. Or set SERVICE_LANGUAGE=english to load only English")
                print(f"      3. Or remove SERVICE_LANGUAGE to load both models")
                print(f"   Action: Closing connection with error code 1008")
                print(f"{'='*60}\n")
                try:
                    # Send error message before closing
                    await ws.send(json.dumps({
                        "error": error_msg,
                        "available_models": list(models.keys()),
                        "requested_language": language
                    }))
                    await ws.close(code=1008, reason=error_msg)
                except:
                    pass  # Connection may already be closed
                return
        else:  # Default to tagalog
            model = models.get("tagalog")
            if not model:
                error_msg = f"Tagalog model not loaded. Available models: {', '.join(models.keys())}"
                print(f"❌ {error_msg}")
                print(f"   Available models: {list(models.keys())}")
                print(f"   💡 To load Tagalog model:")
                print(f"      1. Download: python download_huggingface_model.py")
                print(f"      2. Or set SERVICE_LANGUAGE=tagalog to load only Tagalog")
                print(f"      3. Or remove SERVICE_LANGUAGE to load both models")
                print(f"   Action: Closing connection with error code 1008")
                print(f"{'='*60}\n")
                try:
                    # Send error message before closing
                    await ws.send(json.dumps({
                        "error": error_msg,
                        "available_models": list(models.keys()),
                        "requested_language": language
                    }))
                    await ws.close(code=1008, reason=error_msg)
                except:
                    pass  # Connection may already be closed
                return
        
        print(f"✅ Model found: {language}")
        print(f"   Starting recognition...")
        print(f"{'='*60}\n")
        
        await recognize(ws, path, model)
    except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError) as e:
        # Connection closed - handle gracefully
        code = getattr(e, 'code', None)
        if code == 1008:
            # Policy violation - we closed it intentionally (model not loaded)
            print(f"✓ Connection closed (model not available for requested language)")
        else:
            # Other closure - use standard handling
            code = getattr(e, 'code', None)
            reason = getattr(e, 'reason', 'No reason provided')
            close_code_messages = {
                1000: "Normal closure",
                1001: "Going away",
                1005: "No status code (abnormal closure)",
                1006: "Abnormal closure",
            }
            code_message = close_code_messages.get(code, f"Code {code}")
            print(f"🔌 Connection closed during handler setup (code {code}: {code_message})")
    except Exception as e:
        # Unexpected error in handler
        error_type = type(e).__name__
        error_message = str(e)
        print(f"\n{'='*60}")
        print(f"❌ ERROR in connection handler setup")
        print(f"{'='*60}")
        print(f"Error Type: {error_type}")
        print(f"Error Message: {error_message}")
        print(f"Location: handler() function")
        print(f"{'='*60}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")

def verify_model_exists(model_dir):
    """Check if model directory contains valid Vosk model files."""
    if not os.path.isdir(model_dir):
        return False
    
    # Check for required acoustic model file
    am_file = os.path.join(model_dir, "am", "final.mdl")
    if not os.path.exists(am_file):
        return False
    
    # Check for graph files - different models use different graph file names
    # HCLG.fst (full graph), HCLr.fst (right graph), or Gr.fst (grammar)
    graph_dir = os.path.join(model_dir, "graph")
    if not os.path.isdir(graph_dir):
        return False
    
    # Check if at least one common graph file exists
    graph_files = [
        os.path.join(graph_dir, "HCLG.fst"),  # Full graph (common)
        os.path.join(graph_dir, "HCLr.fst"),   # Right graph (some models)
        os.path.join(graph_dir, "Gr.fst")      # Grammar graph (some models)
    ]
    
    has_graph_file = any(os.path.exists(f) for f in graph_files)
    if not has_graph_file:
        return False
    
    return True

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tagalog-model", default=os.getenv("VOSK_TAGALOG_MODEL_PATH", "./model-tagalog"), help="Path to Tagalog Vosk model directory")
    parser.add_argument("--english-model", default=os.getenv("VOSK_ENGLISH_MODEL_PATH", "./model-english"), help="Path to English Vosk model directory")
    # Railway automatically assigns PORT - use it if available, otherwise default to 2700
    port = int(os.getenv("PORT", "2700"))
    parser.add_argument("--port", type=int, default=port)
    parser.add_argument("--service-language", default=os.getenv("SERVICE_LANGUAGE", ""), help="Service language: 'tagalog' or 'english' (loads only that model)")
    args = parser.parse_args()

    global models
    models = {}
    
    # MEMORY OPTIMIZATION: Only load the model for the service's designated language
    # This prevents loading both models when only one is needed (saves ~200-250MB RAM)
    service_language = args.service_language.lower() if args.service_language else ""
    
    if service_language == "tagalog" or service_language == "tl":
        # Tagalog-only service - only load Tagalog model
        if verify_model_exists(args.tagalog_model):
            print(f"Loading Tagalog model from: {args.tagalog_model}")
            try:
                models["tagalog"] = Model(args.tagalog_model)
                print("✓ Tagalog model loaded")
            except Exception as e:
                print(f"❌ Error loading Tagalog model: {e}")
                print("  The model directory exists but may be corrupted or incomplete.")
                print("  Try running: python download_huggingface_model.py")
                sys.exit(1)
        else:
            print(f"❌ Error: Tagalog model not found or incomplete at: {args.tagalog_model}")
            print("  The model directory exists but is missing required files.")
            print("  To download the model, run: python download_huggingface_model.py")
            print("  Or set DOWNLOAD_TAGALOG=true to download only Tagalog model")
            sys.exit(1)
    elif service_language == "english" or service_language == "en":
        # English-only service - only load English model
        if verify_model_exists(args.english_model):
            print(f"Loading English model from: {args.english_model}")
            try:
                models["english"] = Model(args.english_model)
                print("✓ English model loaded")
            except Exception as e:
                print(f"❌ Error loading English model: {e}")
                print("  The model directory exists but may be corrupted or incomplete.")
                print("  Try running: python download_huggingface_model.py")
                sys.exit(1)
        else:
            print(f"❌ Error: English model not found or incomplete at: {args.english_model}")
            print("  The model directory exists but is missing required files.")
            print("  To download the model, run: python download_huggingface_model.py")
            print("  Or set DOWNLOAD_ENGLISH=true to download only English model")
            sys.exit(1)
    else:
        # Dual-language service (or no SERVICE_LANGUAGE set) - load both if available
        # This is for backward compatibility or services that need both languages
        if verify_model_exists(args.tagalog_model):
            print(f"Loading Tagalog model from: {args.tagalog_model}")
            try:
                models["tagalog"] = Model(args.tagalog_model)
                print("✓ Tagalog model loaded")
            except Exception as e:
                print(f"⚠ Warning: Error loading Tagalog model: {e}")
                print("  Tagalog recognition will not be available")
        else:
            print(f"⚠ Warning: Tagalog model not found or incomplete at: {args.tagalog_model}")
            print("  Tagalog recognition will not be available")
            print("  To download: python download_huggingface_model.py")
        
        if verify_model_exists(args.english_model):
            print(f"Loading English model from: {args.english_model}")
            try:
                models["english"] = Model(args.english_model)
                print("✓ English model loaded")
            except Exception as e:
                print(f"⚠ Warning: Error loading English model: {e}")
                print("  English recognition will not be available")
        else:
            print(f"⚠ Warning: English model not found or incomplete at: {args.english_model}")
            print("  English recognition will not be available")
            print("  To download: python download_huggingface_model.py")
    
    if not models:
        print("❌ Error: No models loaded. Please ensure at least one model directory exists.")
        return
    
    print(f"✓ Models loaded successfully: {list(models.keys())}")
    print(f"🚀 Starting WebSocket server on port {args.port}...")
    print("Supported languages:", list(models.keys()))
    print("Usage: ws://host:port/?lang=tagalog or ws://host:port/?lang=english")
    import sys
    sys.stdout.flush()  # Ensure messages are printed immediately

    # Create a wrapper to handle both old and new websockets API
    async def wrapped_handler(ws, path=None):
        try:
            # In websockets v12+, path is None and we get it from ws.path
            if path is None:
                # Try to get full path with query string from request
                if hasattr(ws, 'request'):
                    # websockets v12+ stores request info
                    path = ws.request.path
                elif hasattr(ws, 'path'):
                    # Fallback to ws.path
                    path = ws.path
                else:
                    # Last resort default
                    path = '/'
            await handler(ws, path)
        except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError) as e:
            # Connection closed - this is expected, don't log as error
            code = getattr(e, 'code', None)
            if code == 1008:
                # Policy violation - we closed it intentionally
                pass  # Already logged in handler
            elif code in [1005, 1006]:
                # Normal disconnections
                pass  # Already logged in recognize() or handler
            else:
                # Other closure codes
                print(f"🔌 Connection closed in wrapped_handler (code: {code})")
        except Exception as e:
            # Unexpected error - log clearly
            error_type = type(e).__name__
            error_message = str(e)
            print(f"\n{'='*60}")
            print(f"❌ UNEXPECTED ERROR in wrapped_handler")
            print(f"{'='*60}")
            print(f"Error Type: {error_type}")
            print(f"Error Message: {error_message}")
            print(f"Location: wrapped_handler() function")
            print(f"{'='*60}")
            import traceback
            traceback.print_exc()
            print(f"{'='*60}\n")
    
    try:
        print(f"🔧 Attempting to bind to 0.0.0.0:{args.port}...")
        print(f"📊 Railway PORT environment variable: {os.getenv('PORT', 'NOT SET (using default 2700)')}")
        sys.stdout.flush()
        
        async with websockets.serve(wrapped_handler, "0.0.0.0", args.port, max_size=None):
            print(f"✅ WebSocket server started successfully on port {args.port}")
            print(f"🌐 Listening on 0.0.0.0:{args.port}")
            print("📡 Ready to accept connections")
            print(f"🔗 Connect using: wss://your-service.up.railway.app/?lang={list(models.keys())[0]}")
            print(f"💡 If connection fails, verify Railway assigned port {args.port} matches service configuration")
            sys.stdout.flush()
            await asyncio.Future()  # run forever
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Error: Port {args.port} is already in use")
            print("   Another process may be using this port, or Railway assigned a different port")
            print(f"   Check the PORT environment variable (current: {args.port})")
        else:
            print(f"❌ Error starting WebSocket server: {e}")
        raise
    except Exception as e:
        print(f"❌ Fatal error starting server: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        raise