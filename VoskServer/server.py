import argparse
import asyncio
import json
import os
import sys
import time
import urllib.parse
import websockets
import numpy as np
from typing import List
import re
from vosk import Model, KaldiRecognizer
from word_matcher import WordMatcherSession
from utils.phil_iri import PhilIRIEngine

DEBUG_PHIL_IRI = os.getenv("DEBUG_PHIL_IRI", "false").lower() in {"1", "true", "yes", "on"}

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
    IMPROVED: Smart word validation with basic filtering.
    
    Args:
        word: Word to validate

    Returns:
        True if word should be accepted, False otherwise
    """
    if not word or len(word.strip()) == 0:
        return False
    
    word_clean = word.strip().lower()
    
    # Reject obvious noise/artifacts
    if len(word_clean) > 20:  # Unreasonably long words
        return False
    
    # Reject words with too many repeated characters (likely artifacts)
    if len(set(word_clean)) == 1 and len(word_clean) > 3:  # "aaaa", "ssss"
        return False
    
    # Reject words with no vowels (except common exceptions)
    vowels = set('aeiou')
    exceptions = {'by', 'my', 'try', 'cry', 'dry', 'fly', 'shy', 'sky', 'why'}
    if not any(c in vowels for c in word_clean) and word_clean not in exceptions:
        return False
    
    # Accept everything else (let vocabulary filtering handle the rest)
    return True


def calculate_word_similarity(word1: str, word2: str) -> float:
    """
    Calculate similarity between two words using Levenshtein distance.
    Returns a value between 0.0 (no similarity) and 1.0 (identical).
    """
    if not word1 or not word2:
        return 0.0
    
    if word1 == word2:
        return 1.0
    
    # Simple Levenshtein distance calculation
    len1, len2 = len(word1), len(word2)
    if len1 < len2:
        word1, word2 = word2, word1
        len1, len2 = len2, len1
    
    if len2 == 0:
        return 0.0
    
    # Create distance matrix
    previous_row = list(range(len2 + 1))
    for i, c1 in enumerate(word1):
        current_row = [i + 1]
        for j, c2 in enumerate(word2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    # Convert distance to similarity
    max_len = max(len1, len2)
    distance = previous_row[-1]
    similarity = (max_len - distance) / max_len
    return similarity


def normalize_vocab_token(token: str) -> str:
    """
    IMPROVED: Better vocabulary normalization that preserves context.
    """
    if token is None:
        return ""
    
    # Remove punctuation but preserve apostrophes and hyphens within words
    normalized = str(token).lower().strip()
    
    # Handle contractions and hyphenated words properly
    import re
    
    # First, try to match complete words with internal punctuation
    word_pattern = r"\b[a-z0-9]+(?:['-][a-z0-9]+)*\b"
    matches = re.findall(word_pattern, normalized)
    
    if matches:
        # Return the longest match (most complete word)
        return max(matches, key=len)
    
    # Fallback: extract any alphanumeric sequence
    fallback_matches = re.findall(r"[a-z0-9']+", normalized)
    if fallback_matches:
        return max(fallback_matches, key=len)  # Return longest sequence
    
    # Last resort: return cleaned input
    return re.sub(r'[^a-z0-9\'-]', '', normalized)


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

    # If the server is running tagalog-only (or english-only), clamp the detected language
    try:
        available_langs = set(models.keys())
        if available_langs and detected_language not in available_langs:
            detected_language = list(available_langs)[0]
    except Exception:
        pass
    

    
    # Track audio format from client
    client_sample_rate = 48000  # Default, can be overridden via config

    # Session data for Phil-IRI summary
    session_start_time = time.time()
    vocabulary = set()  # Story vocabulary for server-side filtering
    expected_words = []  # Expected word sequence for accuracy calculation
    total_words_expected = 0
    session_transcript_words = []
    recent_spoken_words: List[str] = []  # For contextual phonetic correction
    last_accepted_words_lower: List[str] = []  # For partial-text delta gating
    config_ready = False  # Only process Vosk text after frontend sends config
    phil_iri_engine = PhilIRIEngine()
    if DEBUG_PHIL_IRI:
        print(f"[PHIL-IRI-DEBUG] Engine ready (language={detected_language})")

    word_matcher = None  # Simple word matcher - the only matcher we need
    # Accumulate tiny browser chunks before sending to Vosk.
    # 1600 bytes ~= 50ms of 16kHz mono PCM16 audio (FASTER RESPONSE)
    audio_buffer = bytearray()
    buffer_size_target = 1600  # Reduced from 3200 for faster word detection
    
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
                    
                    # Buffer small chunks to improve recognizer stability.
                    audio_buffer.extend(pcm16_audio)
                    if len(audio_buffer) < buffer_size_target:
                        continue

                    audio_chunk = bytes(audio_buffer)
                    audio_buffer.clear()
                    has_final = recognizer.AcceptWaveform(audio_chunk)
                    
                    text = ""
                    
                    # DEBUG: Enhanced Vosk debugging to identify recognition issues
                    if audio_chunks_received % 200 == 0:  # Log every 200 chunks
                        print(f"[DEBUG] Vosk processing: chunk {audio_chunks_received}, has_final={has_final}, audio_bytes={len(audio_chunk)}")
                    
                    if has_final:
                        # Final result - most accurate
                        res = json.loads(recognizer.Result())
                        text = res.get("text", "").strip()
                        
                        if text:
                            print(f"[AUDIO] Vosk FINAL result: '{text}'")
                        else:
                            # Handle empty final result - check if recognizer is working
                            if audio_chunks_received % 100 == 0:  # Log more frequently for debugging
                                print(f"[WARN] Vosk final result empty - chunk {audio_chunks_received}")
                                print(f"   Raw result: {res}")
                                print(f"   Audio bytes: {len(audio_chunk)}")
                                # Continue processing - don't skip the chunk
                    else:
                        # Partial result - faster but less accurate
                        pres = json.loads(recognizer.PartialResult())
                        text = pres.get("partial", "").strip()
                        
                        if text:
                            print(f"[AUDIO] Vosk partial result: '{text}'")
                        # Don't log empty partial results as frequently - they're normal
                    
                    # Guard: only process final Vosk results for stable word advancement.
                    # Partial results often repeat the same prefix and can cause duplicate
                    # word_match events (stuttering / skipping).
                    if text and has_final and config_ready:
                        print(f"[VOSK-FINAL] Processing final result: '{text}'")
                        
                        # Word boundary detection - ensure we have complete words
                        words = text.split()
                        print(f"[WORDS] Split into {len(words)} words: {words}")
                        
                        complete_words = []
                        
                        for word in words:
                            # Check if word is complete (not a partial fragment)
                            word_clean = word.strip().lower()
                            if len(word_clean) >= 1:  # Allow single letters (like "a", "I")
                                # Check if it's a real word (not a fragment)
                                if word_clean.isalpha() or "'" in word_clean or word_clean.isdigit():
                                    complete_words.append(word)
                                    print(f"   [COMPLETE] '{word}' -> accepted")
                                else:
                                    print(f"   [FRAGMENT] '{word}' -> rejected (not alpha/digit)")
                            else:
                                print(f"   [SHORT] '{word}' -> rejected (too short)")
                        
                        print(f"[COMPLETE-WORDS] {len(complete_words)} complete words: {complete_words}")
                        
                        if complete_words:
                            # Process complete words only
                            words = complete_words

                        if words:
                            print(f"[VOCAB-FILTER] Processing {len(words)} words through vocabulary filter")
                            accepted_words: List[str] = []
                            for word in words:
                                token_norm = normalize_vocab_token(word)
                                print(f"   [NORMALIZE] '{word}' -> '{token_norm}'")
                                if token_norm:
                                    if vocabulary:
                                        print(f"   [CHECK] Checking '{token_norm}' against vocabulary of {len(vocabulary)} words")
                                        # Direct match first
                                        if token_norm in vocabulary:
                                            accepted_words.append(token_norm)
                                            print(f"   [MATCH] '{word}' -> '{token_norm}' - direct vocabulary match")
                                        else:
                                            # Try fuzzy matching for pronunciation variations
                                            fuzzy_match_found = False
                                            best_match = None
                                            best_similarity = 0.0
                                            
                                            for vocab_word in vocabulary:
                                                similarity = calculate_word_similarity(token_norm, vocab_word)
                                                if similarity > best_similarity:
                                                    best_similarity = similarity
                                                    best_match = vocab_word
                                                
                                                if similarity >= 0.70:  # 70% similarity threshold
                                                    accepted_words.append(token_norm)
                                                    fuzzy_match_found = True
                                                    print(f"   [FUZZY] '{word}' -> '{token_norm}' - fuzzy match with '{vocab_word}' ({similarity:.2f})")
                                                    break
                                            
                                            if not fuzzy_match_found:
                                                print(f"   [SKIP] '{word}' -> '{token_norm}' - not in vocabulary (best match: '{best_match}' {best_similarity:.2f})")
                                                # Show some vocabulary for debugging
                                                vocab_sample = list(vocabulary)[:5]
                                                print(f"   [VOCAB-SAMPLE] {vocab_sample}")
                                    else:
                                        accepted_words.append(token_norm)
                                        print(f"   [NO-VOCAB] '{word}' -> '{token_norm}' - no vocabulary filter, accepted")
                            
                            print(f"[ACCEPTED] {len(accepted_words)} words accepted: {accepted_words}")

                            accepted_lower = [w.lower().strip() for w in accepted_words]
                            print(f"[ACCEPTED-LOWER] {accepted_lower}")

                            # Compute delta tail vs last accepted words (prefix-based).
                            print(f"[DELTA] Computing delta. Last accepted: {last_accepted_words_lower}")
                            if last_accepted_words_lower:
                                if (
                                    len(accepted_lower) >= len(last_accepted_words_lower)
                                    and accepted_lower[: len(last_accepted_words_lower)] == last_accepted_words_lower
                                ):
                                    new_words = accepted_words[len(last_accepted_words_lower) :]
                                    print(f"[DELTA] Prefix match - new words: {new_words}")
                                elif accepted_lower == last_accepted_words_lower:
                                    new_words = []
                                    print(f"[DELTA] Same as last - no new words")
                                elif len(accepted_lower) > len(last_accepted_words_lower):
                                    # Vosk revised earlier content; avoid flooding by only taking the last word.
                                    new_words = accepted_words[-1:]
                                    print(f"[DELTA] Revision detected - taking last word: {new_words}")
                                else:
                                    new_words = []
                                    print(f"[DELTA] Shorter than last - no new words")
                            else:
                                new_words = accepted_words
                                print(f"[DELTA] First words - all new: {new_words}")

                            # Update last accepted snapshot even if no new words.
                            last_accepted_words_lower = accepted_lower
                            print(f"[DELTA] Updated last accepted to: {last_accepted_words_lower}")

                            if DEBUG_PHIL_IRI and has_final:
                                print(
                                    f"[VOSK-FINAL-DELTA] text='{text}' "
                                    f"accepted={accepted_lower} new={ [w.lower().strip() for w in new_words] if new_words else []}"
                                )

                            if new_words:
                                print(f"[PROCESSING] {len(new_words)} new words: {new_words}")
                                
                                # SIMPLE WORD MATCHING - No complex hybrid or phonetic correction
                                if word_matcher:
                                    for word in new_words:
                                        session_transcript_words.append(word)
                                        match_result = word_matcher.process_word(word)
                                        
                                        # Send word_match event to frontend
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
                                            # MISCUE INFORMATION
                                            "miscue_type": match_result.get("miscue_type", "substitution"),
                                            "miscue_severity": match_result.get("miscue_severity", "moderate"),
                                            # POSITION RECONCILIATION
                                            "server_position": word_matcher.current_position,
                                            "server_words_read": word_matcher.words_read,
                                            "reconciliation_timestamp": send_time
                                        }))
                                else:
                                    # No matcher configured - just send basic text
                                    session_transcript_words.extend(new_words)
                                    await websocket.send(json.dumps({
                                        "text": " ".join(new_words),
                                        "confidence": 1.0,
                                        "timestamp": time.time(),
                                    }))
                        else:
                            # Partial result - process but don't send (prevents jumping)
                            pres = json.loads(recognizer.PartialResult())
                            partial = pres.get("partial", "").strip()
                            # Track partial for stability, but don't send to prevent jumping
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
                                vocabulary = set(
                                    filter(
                                        None,
                                        (normalize_vocab_token(word) for word in config["vocabulary"]),
                                    )
                                )
                                print(f"[OK] Vocabulary loaded: {len(vocabulary)} words for server-side filtering")
                                # Debug: Show first 10 vocabulary words
                                vocab_sample = list(vocabulary)[:10]
                                print(f"   Sample vocabulary: {vocab_sample}")
                                # Debug: Show vocabulary normalization examples
                                if len(vocabulary) > 0:
                                    first_word = list(vocabulary)[0]
                                    print(f"   Normalization example: raw -> normalized")
                                    print(f"   '{first_word}' -> '{normalize_vocab_token(first_word)}'")
                            else:
                                print(f"[WARN] No vocabulary provided in config")
                            
                            # ACCURACY: Store expected word sequence for accuracy calculation
                            if "expected_words" in config:
                                # Normalize for matcher stability but keep index count unchanged.
                                expected_words = [
                                    normalize_vocab_token(word) or str(word).strip().lower()
                                    for word in config["expected_words"]
                                ]
                                total_words_expected = len(expected_words)
                                if DEBUG_PHIL_IRI:
                                    print(f"[PHIL-IRI-DEBUG] expected_words loaded: {total_words_expected}")
                                config_ready = True
                                
                                # SIMPLE WORD MATCHING - No complex hybrid or phrase matchers
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
                    final_words = []
                
                # Extract only NEW words not already sent
                new_words = final_words[words_sent_count:]
                print(f"   [NOTE] New words in final result: {' '.join(new_words)} ({len(new_words)} words)")
                
                # STORY-AWARE FILTERING: Only accept words that are in story or phonetically similar
                filtered_words = []
                
                for word in new_words:
                    should_accept = False
                    
                    # Check if we have story vocabulary loaded
                    if vocabulary:
                        # FIXED: Use same normalization for both vocabulary and spoken words
                        word_normalized = normalize_vocab_token(word)
                        
                        # 1. Direct match in vocabulary - CONSISTENT NORMALIZATION
                        if word_normalized in vocabulary:
                            should_accept = True
                            print(f"   [OK] '{word}' (normalized: '{word_normalized}') - in vocabulary")
                        else:
                            # Try fuzzy matching for pronunciation variations
                            fuzzy_match_found = False
                            for vocab_word in vocabulary:
                                similarity = calculate_word_similarity(word_normalized, vocab_word)
                                if similarity >= 0.70:  # 70% similarity threshold
                                    should_accept = True
                                    fuzzy_match_found = True
                                    print(f"   [OK] '{word}' - fuzzy match with '{vocab_word}' ({similarity:.2f})")
                                    break
                            
                            if not fuzzy_match_found:
                                # Word NOT in vocabulary - REJECT IT
                                print(f"   [FAIL] '{word}' (normalized: '{word_normalized}') - NOT in story vocabulary, REJECTED")
                                # Debug: Show some vocabulary words for comparison
                                vocab_sample = list(vocabulary)[:5]
                                print(f"   [DEBUG] Vocabulary sample: {vocab_sample}")
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
                    session_transcript_words.extend(filtered_words)
                    
                    # Send final result (only NEW words)
                    await websocket.send(json.dumps({
                        "text": filtered_text,
                        "confidence": 1.0,
                        "final": True
                    }))

            # Send end-of-session Phil-IRI summary when we have data.
            if expected_words and session_transcript_words:
                phil_iri_result = phil_iri_engine.analyze(
                    target_text=" ".join(expected_words),
                    student_transcript=" ".join(session_transcript_words),
                )
                if DEBUG_PHIL_IRI:
                    print(
                        f"[PHIL-IRI-DEBUG] summary accuracy={phil_iri_result.get('accuracy_rate')} "
                        f"level={phil_iri_result.get('reading_level')} "
                        f"miscues={phil_iri_result.get('miscue_summary')}"
                    )
                await websocket.send(json.dumps({
                    "type": "phil_iri_summary",
                    **phil_iri_result
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
        
        # Select model based on language.
        # If the requested model isn't available (tagalog-only server),
        # fall back to the available one instead of hard-failing.
        if language == "english" or language == "en":
            requested_language = "english"
            model = models.get("english")
            if not model:
                # Tagalog-only fallback.
                model = models.get("tagalog")
                if model:
                    language = "tagalog"
                    print("[WARN] English requested but only Tagalog model is loaded; falling back to Tagalog.")
                else:
                    error_msg = f"Requested language model not loaded. Available models: {', '.join(models.keys())}"
                    print(f"[FAIL] {error_msg}")
                    try:
                        await ws.send(json.dumps({
                            "error": error_msg,
                            "available_models": list(models.keys()),
                            "requested_language": requested_language
                        }))
                        await ws.close(code=1008, reason=error_msg)
                    except:
                        pass
                    return
        else:
            requested_language = "tagalog"
            model = models.get("tagalog")
            if not model:
                # English-only fallback.
                model = models.get("english")
                if model:
                    language = "english"
                    print("[WARN] Tagalog requested but only English model is loaded; falling back to English.")
                else:
                    error_msg = f"Requested language model not loaded. Available models: {', '.join(models.keys())}"
                    print(f"[FAIL] {error_msg}")
                    try:
                        await ws.send(json.dumps({
                            "error": error_msg,
                            "available_models": list(models.keys()),
                            "requested_language": requested_language
                        }))
                        await ws.close(code=1008, reason=error_msg)
                    except:
                        pass
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
        # 98 = Linux/macOS EADDRINUSE, 10048 = Windows WSAEADDRINUSE
        if e.errno in (98, 10048):
            print(f"[FAIL] Error: Port {args.port} is already in use")
            print("   Another process may already be running this server.")
            print(f"   Try a different port: python server.py --port 2701")
            print("   Or stop the existing process using this port, then restart.")
            return
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