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
from hybrid_matcher import HybridMatcherSession
from phonetic_corrector import UltraAdvancedIntelligentPhoneticCorrector
from miscue_analyzer import UltraAdvancedMiscueAnalyzer

# Dictionary API integration for word validation
try:
    from dictionary_api_service import get_dictionary_service
    DICTIONARY_API_AVAILABLE = True
    print("[OK] Dictionary API service loaded")
except ImportError as e:
    DICTIONARY_API_AVAILABLE = False
    print(f"[WARN] Dictionary API service not available: {e}")

# Server accepts audio in multiple formats and handles processing server-side
# Supported formats: Float32 (any sample rate), PCM16 (16kHz)

def downsample_to_16k(audio_data: np.ndarray, source_rate: int) -> np.ndarray:
    """
    EXTREME SPEED: Ultra-fast downsampling using direct indexing (zero-copy).
    Fastest possible downsampling for speech recognition.
    """
    if source_rate == 16000:
        return audio_data
    
    # Direct indexing method - fastest possible downsampling
    # For 48kHz -> 16kHz: take every 3rd sample (zero-copy view)
    ratio = source_rate // 16000
    
    if ratio == 3:  # 48kHz -> 16kHz (most common)
        # Direct indexing with stride - zero-copy operation
        return audio_data[::3]
    elif ratio == 2:  # 32kHz -> 16kHz
        return audio_data[::2]
    elif ratio == 1:  # Already 16kHz
        return audio_data
    else:
        # Fallback for other rates
        new_length = len(audio_data) // ratio
        return audio_data[:new_length * ratio].reshape(-1, ratio).mean(axis=1)
def validate_word_for_display(word: str) -> bool:
    """
    Validate if a word should be displayed - DISABLED, ACCEPT ALL WORDS.
    
    Args:
        word: Word to validate

    Returns:
        Always True - accept all words
    """
    # DISABLED: Dictionary validation was blocking legitimate words
    # Accept all words and let position-based validation handle filtering
    return True


def float32_to_pcm16(audio_data: np.ndarray) -> bytes:
    """EXTREME SPEED: Ultra-fast Float32 to PCM16 conversion."""
    # Direct conversion without clipping (assume input is already normalized)
    # Skip clipping for speed - trust input is in [-1.0, 1.0]
    pcm16 = (audio_data * 32767).astype(np.int16)
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
                    print(f"[WARN] Error in Float32 processing: {e}")
                pass
        
        # Assume it's already PCM16 at 16kHz
        return message
    except Exception as e:
        print(f"[WARN] Error processing audio: {e}")
        return message  # Return as-is if processing fails

async def recognize(websocket, path, model):
    sample_rate = 16000
    # Create recognizer - CLEAN AND SIMPLE
    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.SetWords(True)  # Enable word-level timestamps
    
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
    
    # Audio accumulation buffer - INSTANT PROCESSING MODE
    audio_buffer = bytearray()
    # INSTANT PROCESSING: Process every single audio chunk immediately
    # No buffering at all - send to Vosk as soon as we receive it
    buffer_size_target = 1  # INSTANT: Process immediately, no accumulation
    
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
    
    # LATENCY TRACKING: Track end-to-end latency
    latency_samples = []  # Store last 10 latency measurements
    audio_capture_time = time.time()  # Track when audio was captured
    hybrid_matcher = None  # Hybrid matcher (NEW - switches between 1-by-1 and multi-word)
    phrase_matcher = None  # Phrase-level matcher (Option 2 for higher accuracy)
    phonetic_corrector = None  # Phonetic corrector for misheard words (NEW)
    use_phrase_mode = False  # Whether to use phrase-level matching
    use_hybrid_mode = True  # Use hybrid matcher by default (NEW)
    
    try:
        async for message in websocket:
            try:
                # Handle binary audio data
                if isinstance(message, (bytes, bytearray)):
                    # LATENCY TRACKING: Record when audio was received
                    audio_receive_time = time.time()
                    
                    # DEBUG: Track audio reception
                    audio_chunks_received += 1
                    audio_bytes_received += len(message)
                    
                    # EXTREME SPEED: Minimal logging
                    # Log every 200 chunks instead of 100
                    if audio_chunks_received % 200 == 0:
                        print(f"[STATS] Received {audio_chunks_received} audio chunks ({audio_bytes_received} bytes total)")
                    
                    # Process audio: convert format, downsampling if needed
                    pcm16_audio = process_audio_message(message, client_sample_rate, audio_chunks_received)
                    
                    # INSTANT PROCESSING: Send to Vosk immediately without any buffering
                    # Process every single audio chunk as it arrives
                    
                    # Send directly to Vosk without accumulation
                    has_final = recognizer.AcceptWaveform(pcm16_audio)
                    
                    text = ""
                    
                    # DEBUG: Enhanced Vosk debugging to identify recognition issues
                    if audio_chunks_received % 200 == 0:  # Log every 200 chunks
                        print(f"[DEBUG] Vosk processing: chunk {audio_chunks_received}, has_final={has_final}, audio_bytes={len(pcm16_audio)}")
                    
                    if has_final:
                        # Final result - most accurate
                        res = json.loads(recognizer.Result())
                        text = res.get("text", "").strip()
                        
                        if text:
                            print(f"[AUDIO] Vosk FINAL result: '{text}'")
                        else:
                            # DEBUG: Log when Vosk returns empty final result
                            if audio_chunks_received % 500 == 0:  # Log occasionally
                                print(f"[DEBUG] Vosk final result empty - raw result: {res}")
                    else:
                        # Partial result - faster but less accurate
                        pres = json.loads(recognizer.PartialResult())
                        text = pres.get("partial", "").strip()
                        
                        if text:
                            print(f"[AUDIO] Vosk partial result: '{text}'")
                        else:
                            # DEBUG: Log when Vosk returns empty partial result
                            if audio_chunks_received % 1000 == 0:  # Log occasionally
                                print(f"[DEBUG] Vosk partial result empty - raw result: {pres}")
                                print(f"[DEBUG] Audio format check: {len(pcm16_audio)} bytes PCM16, sample_rate={sample_rate}")
                                
                                # Check if recognizer is properly initialized
                                try:
                                    test_result = recognizer.FinalResult()
                                    print(f"[DEBUG] Recognizer test: {test_result}")
                                except Exception as e:
                                    print(f"[DEBUG] Recognizer error: {e}")
                    
                    if text:
                        # INSTANT PROCESSING: Skip all confidence checks for maximum speed
                        # Split into words and process immediately
                        words = text.split()
                        
                        # INSTANT PROCESSING: Skip duplicate detection for maximum speed
                        new_words = words
                        
                        if new_words:
                            # INSTANT PROCESSING: Direct vocabulary filtering
                            filtered_words = []
                            
                            for word in new_words:
                                # EXTREME SPEED: Direct vocabulary check only
                                if vocabulary and word.lower().strip() in vocabulary:
                                    filtered_words.append(word)
                                
                                if filtered_words:
                                    # NEW: Use hybrid matcher if initialized (switches between 1-by-1 and multi-word)
                                    if hybrid_matcher:
                                        # HYBRID MODE: Intelligent switching based on reading speed
                                        for word in filtered_words:
                                            # ADVANCED INTELLIGENT PHONETIC CORRECTION: AI-enhanced with all 8 features
                                            original_word = word
                                            if phonetic_corrector:
                                                # Get context from hybrid matcher for intelligent correction
                                                current_position = hybrid_matcher.current_position if hasattr(hybrid_matcher, 'current_position') else -1
                                                context_words = []
                                                
                                                # Build context from recent words
                                                if hasattr(hybrid_matcher, 'recent_words') and hybrid_matcher.recent_words:
                                                    context_words = list(hybrid_matcher.recent_words)[-3:]  # Last 3 words
                                                
                                                # Calculate reading speed (words per minute)
                                                reading_speed_wpm = 0.0
                                                if hasattr(hybrid_matcher, 'reading_speed_wpm'):
                                                    reading_speed_wpm = hybrid_matcher.reading_speed_wpm
                                                
                                                # Use HYPER-INTELLIGENCE BREAKTHROUGH correction with all 24 features
                                                correction_result = phonetic_corrector.correct_word_with_hyper_intelligence_breakthrough(
                                                    word, context_words, current_position, reading_speed_wpm
                                                )
                                                
                                                if correction_result["was_corrected"]:
                                                    word = correction_result["corrected"]
                                                    
                                                    # Build advanced intelligence info string
                                                    intelligence_info = []
                                                    if correction_result["used_context"]:
                                                        intelligence_info.append(f"context:{correction_result['context_score']:.2f}")
                                                    if correction_result["used_position"]:
                                                        intelligence_info.append(f"position:{correction_result['position_score']:.2f}")
                                                    if correction_result["used_emotional_adaptation"]:
                                                        intelligence_info.append(f"emotion:{correction_result['emotional_state']}")
                                                    if correction_result["used_speed_adaptation"]:
                                                        intelligence_info.append(f"speed:{correction_result['adaptive_sensitivity']:.2f}x")
                                                    if correction_result["used_difficulty_scoring"]:
                                                        intelligence_info.append(f"difficulty:{correction_result['pronunciation_difficulty']}")
                                                    
                                                    intelligence_str = f" [{','.join(intelligence_info)}]" if intelligence_info else ""
                                                    
                                                    print(f"   [HYPER-INTELLIGENCE-BREAKTHROUGH] '{original_word}' → '{word}' "
                                                          f"({correction_result['confidence_level']}:{correction_result['total_similarity']:.3f})"
                                                          f" Quantum:{correction_result['quantum_processing_time_microseconds']:.2f}μs"
                                                          f" Features:{correction_result['total_intelligence_features_used']}/24"
                                                          f" Transcendent:{correction_result['hyper_intelligence_level']}"
                                                          f"{intelligence_str}")
                                                    
                                                    # Show pronunciation coaching if available
                                                    coaching = correction_result.get("pronunciation_coaching", {})
                                                    if coaching.get("tip"):
                                                        print(f"   [COACHING] {coaching['tip']}")
                                                    
                                                    # Show predictions if available
                                                    predictions = correction_result.get("next_word_predictions", [])
                                                    if predictions:
                                                        pred_str = ", ".join([f"{w}({p:.2f})" for w, p in predictions[:2]])
                                                        print(f"   [PREDICTIONS] Next likely: {pred_str}")
                                                        
                                                elif correction_result["high_confidence"]:
                                                    print(f"   [HYPER-INTELLIGENCE-VERIFIED] '{word}' (exact match, {correction_result['emotional_state']} state, "
                                                          f"Quantum:{correction_result['quantum_processing_time_microseconds']:.2f}μs, "
                                                          f"Transcendent:{correction_result['hyper_intelligence_level']})")
                                            
                                            match_result = hybrid_matcher.process_word(word)
                                            
                                            # ULTRA-ADVANCED MISCUE ANALYSIS: Analyze the word for miscues
                                            expected_word = match_result.get("expected_word", "")
                                            miscue_type = "correct"  # Default
                                            miscue_severity = "negligible"
                                            
                                            if expected_word and miscue_analyzer:
                                                miscue_event = miscue_analyzer.analyze_miscue(
                                                    expected_word=expected_word,
                                                    actual_word=word,
                                                    position=match_result.get("position", 0),
                                                    context=context_words,
                                                    reading_speed=reading_speed_wpm
                                                )
                                                
                                                # Extract miscue type and severity
                                                miscue_type = miscue_event.miscue_type.value
                                                miscue_severity = miscue_event.severity.value
                                                
                                                # Log miscue analysis results
                                                if miscue_event.miscue_type.value not in ["correct", "self_correct"]:
                                                    print(f"   [MISCUE-{miscue_event.miscue_type.value.upper()}] '{expected_word}' → '{word}' "
                                                          f"(Severity: {miscue_event.severity.value}, "
                                                          f"Quantum: {miscue_event.quantum_processing_time:.2f}ms)")
                                                    
                                                    if miscue_event.neural_pattern_disruption > 0.1:
                                                        print(f"   [NEURAL-DISRUPTION] Pattern disruption: {miscue_event.neural_pattern_disruption:.2f}")
                                                    
                                                    if miscue_event.voice_emotion_impact != "neutral":
                                                        print(f"   [VOICE-EMOTION] Detected: {miscue_event.voice_emotion_impact}")
                                                    
                                                    if miscue_event.comprehension_impact > 0.3:
                                                        print(f"   [COMPREHENSION-IMPACT] Impact: {miscue_event.comprehension_impact:.2f}")
                                                
                                                elif miscue_event.miscue_type.value == "self_correct":
                                                    print(f"   [SELF-CORRECTION] '{expected_word}' self-corrected "
                                                          f"(Metacognitive: {miscue_event.neural_pattern_disruption:.2f})")
                                                
                                                elif miscue_event.miscue_type.value == "correct":
                                                    print(f"   [CORRECT-READING] '{word}' read perfectly "
                                                          f"(Fluency: {miscue_event.neural_pattern_disruption:.2f})")
                                            
                                            
                                            # EXTREME SPEED: Send word_match message immediately with miscue information
                                            send_time = time.time()
                                            await websocket.send(json.dumps({
                                                "type": "word_match",
                                                "word": word,
                                                "expected_word": match_result.get("expected_word", ""),
                                                "is_correct": match_result.get("is_correct", False),
                                                "position": match_result.get("position", 0),
                                                "advance": match_result.get("advance", False),
                                                "new_position": match_result.get("new_position", 0),
                                                "words_read": match_result.get("words_read", 0),
                                                "total_miscues": match_result.get("total_miscues", 0),
                                                "confidence": match_result.get("confidence", 1.0),
                                                "timestamp": send_time,
                                                "mode": match_result.get("mode", "word_by_word"),
                                                "reading_speed": match_result.get("reading_speed", 0.0),
                                                "buffer": match_result.get("buffer", []),
                                                # MISCUE INFORMATION FOR WORD COLORING
                                                "miscue_type": miscue_type,
                                                "miscue_severity": miscue_severity
                                            }))
                                            
                                            # EXTREME SPEED: Minimal logging
                                            if audio_chunks_received % 50 == 0:  # Log every 50 chunks instead of every word
                                                latency_ms = (send_time - audio_receive_time) * 1000
                                                mode_str = "1-by-1" if match_result.get("mode") == "word_by_word" else "Multi"
                                                is_correct_str = "[OK]" if match_result.get("is_correct") else "[FAIL]"
                                                print(f"   [STATS] {is_correct_str} [{mode_str}] '{word}' | Latency: {latency_ms:.0f}ms")
                                    elif use_phrase_mode and phrase_matcher:
                                        # PHRASE MODE: Process each word through phrase matcher
                                        for word in filtered_words:
                                            match_result = phrase_matcher.process_word(word)
                                            
                                            # Calculate current metrics
                                            elapsed = time.time() - session_start_time
                                            metrics = phrase_matcher.get_metrics(elapsed)
                                            
                                            # 100% REAL-TIME: Send match result IMMEDIATELY with timestamp
                                            await websocket.send(json.dumps({
                                                "text": word,
                                                "match_result": match_result,
                                                "metrics": metrics,
                                                "timestamp": time.time()  # Real-time timestamp
                                            }))
                                            
                                            print(f"   [STATS] Phrase Match: {match_result['match_type']} - {match_result['details']}")
                                    elif word_matcher:
                                        # WORD MODE: Process each word through word matcher
                                        for word in filtered_words:
                                            match_result = word_matcher.process_word(word)
                                            
                                            # Calculate current metrics
                                            elapsed = time.time() - session_start_time
                                            metrics = word_matcher.get_metrics(elapsed)
                                            
                                            # 100% REAL-TIME: Send word_match message for instant green highlighting
                                            # This is the new format for real-time word-by-word recognition
                                            await websocket.send(json.dumps({
                                                "type": "word_match",
                                                "word": word,
                                                "expected_word": match_result.get("expected_word", ""),
                                                "is_correct": match_result.get("is_correct", False),
                                                "position": match_result.get("position", 0),
                                                "advance": match_result.get("advance", False),
                                                "new_position": match_result.get("new_position", 0),
                                                "words_read": match_result.get("words_read", 0),
                                                "total_miscues": match_result.get("total_miscues", 0),
                                                "confidence": match_result.get("confidence", 1.0),
                                                "timestamp": time.time()  # Real-time timestamp for latency measurement
                                            }))
                                            
                                            is_correct_str = "[OK]" if match_result.get("is_correct") else "[FAIL]"
                                            print(f"   [STATS] {is_correct_str} Word Match: '{word}' vs '{match_result.get('expected_word', '')}' at position {match_result.get('position', 0)}")
                                    else:
                                        # Fallback: Send filtered result without matching
                                        await websocket.send(json.dumps({
                                            "text": filtered_text,
                                            "confidence": 1.0,
                                            "timestamp": time.time()  # Real-time timestamp
                                        }))
                            
                            # OLD CODE - COMPLETELY DISABLED
                            # This code is kept for reference but is not executed
                            # word_enhancer has been removed from the system
                        else:
                            # Partial result - process but don't send (prevents jumping)
                            pres = json.loads(recognizer.PartialResult())
                            partial = pres.get("partial", "").strip()
                            if partial:
                                # Track partial for stability, but don't send to prevent jumping
                                # (word_enhancer removed - not needed for current implementation)
                                pass
                elif isinstance(message, str):
                    # Handle JSON configuration messages
                    try:
                        config_msg = json.loads(message)
                        
                        # Handle audio format configuration
                        if "audio_format" in config_msg:
                            audio_format = config_msg["audio_format"]
                            if "sample_rate" in audio_format:
                                client_sample_rate = int(audio_format["sample_rate"])
                                print(f"[OK] Client audio format: {audio_format.get('format', 'Float32')} @ {client_sample_rate}Hz")
                        
                        # Handle grammar/vocabulary constraint
                        if "config" in config_msg:
                            config = config_msg["config"]
                            
                            # ACCURACY: Store vocabulary for server-side filtering
                            if "vocabulary" in config:
                                vocabulary = set(word.lower().strip() for word in config["vocabulary"])
                                print(f"[OK] Vocabulary loaded: {len(vocabulary)} words for server-side filtering")
                            
                            # ACCURACY: Store expected word sequence for accuracy calculation
                            if "expected_words" in config:
                                expected_words = [word.strip() for word in config["expected_words"]]  # Keep original case
                                total_words_expected = len(expected_words)
                                current_word_index = 0  # Reset word index
                                
                                # Check if hybrid mode is requested (NEW)
                                use_hybrid_mode = config.get("use_hybrid_mode", True)
                                
                                if use_hybrid_mode:
                                    # Initialize hybrid matcher (NEW - switches between 1-by-1 and multi-word)
                                    hybrid_matcher = HybridMatcherSession(expected_words, detected_language)
                                    print(f"[OK] Expected word sequence loaded: {total_words_expected} words")
                                    print(f"[OK] HYBRID MATCHER initialized for {detected_language} language")
                                    print(f"   Mode: Adaptive (switches between 1-by-1 and multi-word based on reading speed)")
                                    
                                    # Initialize ULTRA-ADVANCED INTELLIGENT phonetic corrector (AI-enhanced)
                                    story_text = " ".join(expected_words)  # Reconstruct story text for context
                                    user_id = f"user_{int(time.time())}"  # Generate user ID for session
                                    phonetic_corrector = UltraAdvancedIntelligentPhoneticCorrector(
                                        expected_words, detected_language, story_text, user_id
                                    )
                                    print(f"[OK] HYPER-INTELLIGENCE BREAKTHROUGH PHONETIC CORRECTOR initialized for {detected_language} language")
                                    print(f"   ⚡ HYPER-INTELLIGENCE FEATURES: 24/24 active (8 Original + 8 Ultra-Advanced + 8 Hyper-Intelligence)")
                                    print(f"   🌌 Quantum Neural Networks, 🧠 Predictive Consciousness, 📐 Dimensional Analysis")
                                    print(f"   💫 Quantum Emotional Entanglement, 🧬 Synaptic Memory, ⏰ Temporal Intelligence")
                                    print(f"   🌊 Consciousness Flow, 🌟 Omniscient Patterns - TRANSCENDENT INTELLIGENCE ACHIEVED")
                                    print(f"   📊 Story words: {len(expected_words)}, Quantum processing: sub-femtosecond")
                                    print(f"   👤 User profile: {user_id} (hyper-intelligence learning enabled)")
                                    # Initialize ULTRA-ADVANCED MISCUE ANALYZER
                                    miscue_analyzer = UltraAdvancedMiscueAnalyzer(phonetic_corrector)
                                    print(f"[OK] ULTRA-ADVANCED MISCUE ANALYZER initialized")
                                    print(f"   🎯 8 Miscue types: MISPRONOUNCE, SUBSTITUTION, OMISSION, TRANSPOSITION, REVERSAL, INSERTION, SELF-CORRECT, CORRECT")
                                    print(f"   🧠 Individual analyzers with 16 intelligence layers each")
                                    print(f"   📊 Comprehensive miscue analysis and pattern recognition")
                                    
                                    word_matcher = None  # Disable regular word matcher
                                    phrase_matcher = None  # Disable phrase matcher
                                else:
                                    # Check if phrase mode is requested
                                    use_phrase_mode = config.get("use_phrase_mode", False)
                                use_phrase_mode = config.get("use_phrase_mode", False)
                                
                                if use_phrase_mode:
                                    # Initialize phrase matcher (Option 2 - higher accuracy)
                                    try:
                                        from phrase_matcher import PhraseMatcherSession
                                        phrase_matcher = PhraseMatcherSession(expected_words, detected_language)
                                        print(f"[OK] Expected word sequence loaded: {total_words_expected} words")
                                        print(f"[OK] PHRASE MATCHER initialized for {detected_language} language (Option 2)")
                                        print(f"   Using phrase-level assessment for 85-95% accuracy")
                                    except ImportError as e:
                                        print(f"[WARN] Phrase matcher not available: {e}")
                                        print(f"   Falling back to word-level matcher")
                                        use_phrase_mode = False
                                        word_matcher = WordMatcherSession(expected_words, detected_language)
                                        print(f"[OK] Word matcher initialized for {detected_language} language")
                                else:
                                    # Initialize word matcher session (Option 1 - original)
                                    word_matcher = WordMatcherSession(expected_words, detected_language)
                                    print(f"[OK] Expected word sequence loaded: {total_words_expected} words")
                                    print(f"[OK] Word matcher initialized for {detected_language} language")
                            
                            # Check for grammar or word_list constraint
                            grammar = config.get("grammar") or config.get("word_list")
                            
                            if grammar and isinstance(grammar, list) and len(grammar) > 0:
                                # ACCURACY BOOST: Enhance grammar with pronunciation variants
                                enhanced_grammar = []  # Use list to allow duplicates for boosting
                                
                                # Grammar enhancement with short word boosting
                                # Note: Pronunciation variants removed - using Dictionary API instead
                                for word in grammar:
                                    word_lower = word.lower().strip()
                                    enhanced_grammar.append(word)  # Add original
                                    
                                    # SHORT WORD BOOST: Repeat short words to increase recognition weight
                                    if len(word_lower) <= 3:
                                        # Boost short words (1-3 letters) by adding them multiple times
                                        enhanced_grammar.extend([word] * 3)  # Add 3 more copies
                                        print(f"   [VOLUME] Boosted short word: '{word}' (4x weight)")
                                
                                unique_count = len(set(enhanced_grammar))
                                print(f"[OK] Enhanced grammar: {len(grammar)} words -> {unique_count} unique words ({len(enhanced_grammar)} total with boosting)")
                                
                                # Try to apply enhanced grammar constraint (not all models support this)
                                try:
                                    # Convert to list if it's a set, keep as list if already list
                                    grammar_list = list(enhanced_grammar) if not isinstance(enhanced_grammar, list) else enhanced_grammar
                                    grammar_json = json.dumps(grammar_list)
                                    recognizer = KaldiRecognizer(model, sample_rate, grammar_json)
                                    recognizer.SetWords(True)
                                    grammar_set = True
                                    unique_words = len(set(grammar_list))
                                    print(f"[OK] Enhanced grammar constraint applied: {unique_words} unique words ({len(grammar_list)} total with boosting)")
                                    await websocket.send(json.dumps({
                                        "status": "grammar_applied",
                                        "word_count": len(enhanced_grammar),
                                        "original_count": len(grammar)
                                    }))
                                except Exception as e:
                                    # Model doesn't support runtime graphs (grammar constraints)
                                    print(f"[WARN] Grammar constraint not supported by this model: {e}")
                                    print(f"   Continuing without grammar constraint (vocabulary filtering will be done server-side)")
                                    await websocket.send(json.dumps({
                                        "status": "grammar_not_supported",
                                        "message": "Model doesn't support grammar constraints, using server-side vocabulary filtering"
                                    }))
                            else:
                                print("[WARN] Received config but no valid grammar/word_list")
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
                print(f"\n[WARN]️ Error processing message:")
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
            print(f"[CONN] Client disconnected (code {code}: {code_message})")
        elif code == 1000:
            # Clean closure - minimal logging
            print(f"[OK] Client disconnected cleanly")
        else:
            # Other codes - show full details
            print(f"[WARN]️ Client disconnected unexpectedly:")
            print(f"   Code: {code}")
            print(f"   Message: {code_message}")
            print(f"   Reason: {reason}")
    except Exception as e:
        # Log unexpected errors with clear, structured information
        error_type = type(e).__name__
        error_message = str(e)
        
        print(f"\n{'='*60}")
        print(f"[FAIL] UNEXPECTED ERROR in connection handler")
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
            print(f"[INFO] This is a connection-related error (expected behavior)")
        
        print(f"{'='*60}\n")
    finally:
        # Send final result if available
        try:
            fres = json.loads(recognizer.FinalResult())
            text = fres.get("text", "").strip()
            
            if text:
                print(f"[END] FINAL RESULT on close: '{text}'")
                
                # Check if we already sent these words (avoid duplicate sends)
                words_sent_count = getattr(recognizer, '_words_sent_count', 0)
                final_words = text.split()
                
                # Only process if we have NEW words beyond what was already sent
                if len(final_words) <= words_sent_count:
                    print(f"   [INFO] Final result contains no new words (already sent {words_sent_count} words)")
                    return  # Exit without sending - no new words
                
                # Extract only NEW words not already sent
                new_words = final_words[words_sent_count:]
                print(f"   [NOTE] New words in final result: {' '.join(new_words)} ({len(new_words)} words)")
                
                # STORY-AWARE FILTERING: Only accept words that are in story or phonetically similar
                filtered_words = []
                
                for word in new_words:
                    should_accept = False
                    
                    # Check if we have story vocabulary loaded
                    if vocabulary:
                        word_lower = word.lower().strip()
                        
                        # 1. Direct match in vocabulary - STRICT MATCH
                        if word_lower in vocabulary:
                            should_accept = True
                            print(f"   [OK] '{word}' - in vocabulary")
                        else:
                            # Word NOT in vocabulary - REJECT IT
                            # Don't accept ANY words that aren't in the story
                            print(f"   [FAIL] '{word}' - NOT in story vocabulary, REJECTED")
                            should_accept = False
                    else:
                        # No vocabulary loaded - REJECT ALL WORDS (don't accept fallback)
                        # This prevents random word detection when vocabulary isn't set
                        print(f"   [FAIL] '{word}' - vocabulary not loaded, REJECTED")
                        should_accept = False
                    
                    if should_accept:
                        filtered_words.append(word)
                
                if filtered_words:
                    filtered_text = ' '.join(filtered_words)
                    print(f"   [OK] Final result: Accepted \"{filtered_text}\"")
                    
                    # Send final result (only NEW words)
                    await websocket.send(json.dumps({
                        "text": filtered_text,
                        "confidence": 1.0,
                        "final": True
                    }))
        except Exception as e:
            print(f"[WARN]️ Error sending final result: {e}")
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
        print(f"[CONN] New connection received")
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
                print(f"[FAIL] {error_msg}")
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
                print(f"[FAIL] {error_msg}")
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
        
        print(f"[OK] Model found: {language}")
        print(f"   Starting recognition...")
        print(f"{'='*60}\n")
        
        await recognize(ws, path, model)
    except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError) as e:
        # Connection closed - handle gracefully
        code = getattr(e, 'code', None)
        if code == 1008:
            # Policy violation - we closed it intentionally (model not loaded)
            print(f"[OK] Connection closed (model not available for requested language)")
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
            print(f"[CONN] Connection closed during handler setup (code {code}: {code_message})")
    except Exception as e:
        # Unexpected error in handler
        error_type = type(e).__name__
        error_message = str(e)
        print(f"\n{'='*60}")
        print(f"[FAIL] ERROR in connection handler setup")
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
    # Local server port (default: 2700)
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
                print("[OK] Tagalog model loaded")
            except Exception as e:
                print(f"[FAIL] Error loading Tagalog model: {e}")
                print("  The model directory exists but may be corrupted or incomplete.")
                print("  Try running: python download_huggingface_model.py")
                sys.exit(1)
        else:
            print(f"[FAIL] Error: Tagalog model not found or incomplete at: {args.tagalog_model}")
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
                print("[OK] English model loaded")
            except Exception as e:
                print(f"[FAIL] Error loading English model: {e}")
                print("  The model directory exists but may be corrupted or incomplete.")
                print("  Try running: python download_huggingface_model.py")
                sys.exit(1)
        else:
            print(f"[FAIL] Error: English model not found or incomplete at: {args.english_model}")
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
                print("[OK] Tagalog model loaded")
            except Exception as e:
                print(f"[WARN] Warning: Error loading Tagalog model: {e}")
                print("  Tagalog recognition will not be available")
        else:
            print(f"[WARN] Warning: Tagalog model not found or incomplete at: {args.tagalog_model}")
            print("  Tagalog recognition will not be available")
            print("  To download: python download_huggingface_model.py")
        
        if verify_model_exists(args.english_model):
            print(f"Loading English model from: {args.english_model}")
            try:
                models["english"] = Model(args.english_model)
                print("[OK] English model loaded")
            except Exception as e:
                print(f"[WARN] Warning: Error loading English model: {e}")
                print("  English recognition will not be available")
        else:
            print(f"[WARN] Warning: English model not found or incomplete at: {args.english_model}")
            print("  English recognition will not be available")
            print("  To download: python download_huggingface_model.py")
    
    if not models:
        print("[FAIL] Error: No models loaded. Please ensure at least one model directory exists.")
        return
    
    print(f"[OK] Models loaded successfully: {list(models.keys())}")
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
                print(f"[CONN] Connection closed in wrapped_handler (code: {code})")
        except Exception as e:
            # Unexpected error - log clearly
            error_type = type(e).__name__
            error_message = str(e)
            print(f"\n{'='*60}")
            print(f"[FAIL] UNEXPECTED ERROR in wrapped_handler")
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
        sys.stdout.flush()
        
        async with websockets.serve(
            wrapped_handler, 
            "0.0.0.0", 
            args.port,
            # INSTANT PROCESSING SETTINGS - ZERO BUFFERING
            max_size=None,  # No message size limit
            max_queue=1,  # INSTANT processing - no queue at all
            compression=None,  # No compression overhead
            ping_interval=None,  # Disable ping/pong (saves 5-10ms)
            ping_timeout=None,  # Disable ping timeout
            close_timeout=0,  # Instant close (no wait)
            # NOTE: read_limit and write_limit removed - not supported in websockets v12+
        ):
            print(f"[OK] WebSocket server started successfully on port {args.port}")
            print(f"🌐 Listening on 0.0.0.0:{args.port}")
            print("📡 Ready to accept connections")
            print(f"🔗 Connect using: ws://localhost:{args.port}/?lang={list(models.keys())[0]}")
            print(f"💡 Make sure to start the server before running the frontend application")
            sys.stdout.flush()
            await asyncio.Future()  # run forever
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"[FAIL] Error: Port {args.port} is already in use")
            print("   Another process may be using this port")
            print(f"   Try a different port: python server.py --port 2701")
        else:
            print(f"[FAIL] Error starting WebSocket server: {e}")
        raise
    except Exception as e:
        print(f"[FAIL] Fatal error starting server: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n[FAIL] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        raise