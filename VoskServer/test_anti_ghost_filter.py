"""
Unit tests for Anti-Ghost Word Detection System

Tests all filter layers, matching logic, and edge cases.
"""

import unittest
from anti_ghost_filter import (
    GhostWordFilter,
    WordMatcher,
    process_recognition_result,
    configure_filter_thresholds,
    get_filter_stats
)


class TestGhostWordFilter(unittest.TestCase):
    """Test the three-layer ghost word filtering system."""
    
    def test_confidence_filter_pass(self):
        """Test that high confidence words pass the filter."""
        word_data = {'word': 'cat', 'conf': 0.95, 'start': 0.0, 'end': 0.5}
        self.assertTrue(GhostWordFilter.apply_confidence_filter(word_data))
    
    def test_confidence_filter_fail(self):
        """Test that low confidence words are filtered out."""
        word_data = {'word': 'cat', 'conf': 0.60, 'start': 0.0, 'end': 0.5}
        self.assertFalse(GhostWordFilter.apply_confidence_filter(word_data))
    
    def test_confidence_filter_boundary(self):
        """Test confidence filter at exact threshold."""
        word_data = {'word': 'cat', 'conf': 0.75, 'start': 0.0, 'end': 0.5}
        self.assertTrue(GhostWordFilter.apply_confidence_filter(word_data))
    
    def test_duration_filter_pass(self):
        """Test that normal duration words pass the filter."""
        word_data = {'word': 'cat', 'conf': 0.95, 'start': 0.0, 'end': 0.5}
        self.assertTrue(GhostWordFilter.apply_duration_filter(word_data))
    
    def test_duration_filter_fail(self):
        """Test that ultra-short duration words are filtered out."""
        word_data = {'word': 'uh', 'conf': 0.95, 'start': 0.0, 'end': 0.10}
        self.assertFalse(GhostWordFilter.apply_duration_filter(word_data))
    
    def test_duration_filter_boundary(self):
        """Test duration filter at exact threshold."""
        word_data = {'word': 'cat', 'conf': 0.95, 'start': 0.0, 'end': 0.15}
        self.assertTrue(GhostWordFilter.apply_duration_filter(word_data))
    
    def test_duplicate_filter_pass(self):
        """Test that different words pass the duplicate filter."""
        self.assertTrue(GhostWordFilter.apply_duplicate_filter('cat', 'the'))
    
    def test_duplicate_filter_fail(self):
        """Test that consecutive duplicates are filtered out."""
        self.assertFalse(GhostWordFilter.apply_duplicate_filter('the', 'the'))
    
    def test_duplicate_filter_case_insensitive(self):
        """Test that duplicate filter is case-insensitive."""
        self.assertFalse(GhostWordFilter.apply_duplicate_filter('The', 'the'))
    
    def test_duplicate_filter_no_last_word(self):
        """Test duplicate filter when there's no previous word."""
        self.assertTrue(GhostWordFilter.apply_duplicate_filter('cat', None))
    
    def test_filter_word_all_pass(self):
        """Test that valid words pass all filters."""
        word_data = {'word': 'cat', 'conf': 0.95, 'start': 0.0, 'end': 0.5}
        self.assertTrue(GhostWordFilter.filter_word(word_data, 'the'))
    
    def test_filter_word_confidence_fail(self):
        """Test that low confidence words fail overall filter."""
        word_data = {'word': 'cat', 'conf': 0.60, 'start': 0.0, 'end': 0.5}
        self.assertFalse(GhostWordFilter.filter_word(word_data, 'the'))
    
    def test_filter_word_duration_fail(self):
        """Test that short duration words fail overall filter."""
        word_data = {'word': 'uh', 'conf': 0.95, 'start': 0.0, 'end': 0.10}
        self.assertFalse(GhostWordFilter.filter_word(word_data, 'the'))
    
    def test_filter_word_duplicate_fail(self):
        """Test that duplicates fail overall filter."""
        word_data = {'word': 'the', 'conf': 0.95, 'start': 0.0, 'end': 0.5}
        self.assertFalse(GhostWordFilter.filter_word(word_data, 'the'))


class TestWordMatcher(unittest.TestCase):
    """Test the position-aware word matching engine."""
    
    def setUp(self):
        """Set up test story."""
        self.story = ["the", "cat", "sat", "on", "the", "mat"]
    
    def test_levenshtein_distance_identical(self):
        """Test Levenshtein distance for identical strings."""
        self.assertEqual(WordMatcher.levenshtein_distance("cat", "cat"), 0)
    
    def test_levenshtein_distance_one_substitution(self):
        """Test Levenshtein distance with one substitution."""
        self.assertEqual(WordMatcher.levenshtein_distance("cat", "bat"), 1)
    
    def test_levenshtein_distance_one_insertion(self):
        """Test Levenshtein distance with one insertion."""
        self.assertEqual(WordMatcher.levenshtein_distance("cat", "cats"), 1)
    
    def test_levenshtein_distance_one_deletion(self):
        """Test Levenshtein distance with one deletion."""
        self.assertEqual(WordMatcher.levenshtein_distance("cats", "cat"), 1)
    
    def test_levenshtein_distance_multiple_edits(self):
        """Test Levenshtein distance with multiple edits."""
        self.assertEqual(WordMatcher.levenshtein_distance("cat", "dog"), 3)
    
    def test_check_correct_match(self):
        """Test correct word matching."""
        self.assertTrue(WordMatcher.check_correct("cat", "cat"))
    
    def test_check_correct_case_insensitive(self):
        """Test correct matching is case-insensitive."""
        self.assertTrue(WordMatcher.check_correct("Cat", "cat"))
    
    def test_check_correct_no_match(self):
        """Test correct matching fails for different words."""
        self.assertFalse(WordMatcher.check_correct("dog", "cat"))
    
    def test_check_omission(self):
        """Test omission detection (spoken matches next word)."""
        self.assertTrue(WordMatcher.check_omission("cat", self.story, 0))
    
    def test_check_omission_no_match(self):
        """Test omission detection fails when not matching next word."""
        self.assertFalse(WordMatcher.check_omission("dog", self.story, 0))
    
    def test_check_omission_at_end(self):
        """Test omission detection at end of story."""
        self.assertFalse(WordMatcher.check_omission("word", self.story, len(self.story) - 1))
    
    def test_check_repetition_found(self):
        """Test repetition detection for previous word."""
        is_rep, pos = WordMatcher.check_repetition("the", self.story, 1)
        self.assertTrue(is_rep)
        self.assertEqual(pos, 0)
    
    def test_check_repetition_not_found(self):
        """Test repetition detection when word not in previous words."""
        is_rep, pos = WordMatcher.check_repetition("dog", self.story, 2)
        self.assertFalse(is_rep)
        self.assertEqual(pos, -1)
    
    def test_check_repetition_at_start(self):
        """Test repetition detection at start of story."""
        is_rep, pos = WordMatcher.check_repetition("the", self.story, 0)
        self.assertFalse(is_rep)
    
    def test_check_reversal(self):
        """Test reversal detection (was/saw)."""
        self.assertTrue(WordMatcher.check_reversal("saw", "was"))
    
    def test_check_reversal_no_match(self):
        """Test reversal detection fails for non-reversals."""
        self.assertFalse(WordMatcher.check_reversal("cat", "dog"))
    
    def test_check_substitution_one_edit(self):
        """Test substitution detection with one edit."""
        self.assertTrue(WordMatcher.check_substitution("cat", "bat"))
    
    def test_check_substitution_too_different(self):
        """Test substitution detection fails for very different words."""
        self.assertFalse(WordMatcher.check_substitution("cat", "dog"))
    
    def test_match_word_correct(self):
        """Test matching correct word."""
        miscue_type, new_pos = WordMatcher.match_word("the", self.story, 0)
        self.assertEqual(miscue_type, "correct")
        self.assertEqual(new_pos, 1)
    
    def test_match_word_omission(self):
        """Test matching with omission."""
        miscue_type, new_pos = WordMatcher.match_word("cat", self.story, 0)
        self.assertEqual(miscue_type, "omission")
        self.assertEqual(new_pos, 2)
    
    def test_match_word_repetition(self):
        """Test matching with repetition."""
        miscue_type, new_pos = WordMatcher.match_word("the", self.story, 1)
        self.assertEqual(miscue_type, "repetition")
        self.assertEqual(new_pos, 1)  # Position doesn't advance
    
    def test_match_word_reversal(self):
        """Test matching with reversal."""
        story = ["was", "the", "cat"]
        miscue_type, new_pos = WordMatcher.match_word("saw", story, 0)
        self.assertEqual(miscue_type, "reversal")
        self.assertEqual(new_pos, 1)
    
    def test_match_word_substitution(self):
        """Test matching with substitution."""
        miscue_type, new_pos = WordMatcher.match_word("bat", self.story, 1)
        self.assertEqual(miscue_type, "substitution")
        self.assertEqual(new_pos, 2)
    
    def test_match_word_noise(self):
        """Test matching with noise (no match)."""
        miscue_type, new_pos = WordMatcher.match_word("xyz", self.story, 0)
        self.assertEqual(miscue_type, "noise")
        self.assertEqual(new_pos, 0)  # Position doesn't advance
    
    def test_match_word_beyond_story(self):
        """Test matching when position is beyond story length."""
        miscue_type, new_pos = WordMatcher.match_word("word", self.story, 100)
        self.assertEqual(miscue_type, "noise")
        self.assertEqual(new_pos, 100)


class TestProcessRecognitionResult(unittest.TestCase):
    """Test the main processing function."""
    
    def setUp(self):
        """Set up test story."""
        self.story = ["the", "cat", "sat", "on", "the", "mat"]
    
    def test_process_correct_word(self):
        """Test processing a correct word."""
        result = {
            "result": [{"word": "the", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertEqual(output['accepted_word'], 'the')
        self.assertEqual(output['miscue_type'], 'correct')
        self.assertEqual(output['new_position'], 1)
        self.assertEqual(output['last_word'], 'the')
    
    def test_process_low_confidence_filtered(self):
        """Test that low confidence words are filtered."""
        result = {
            "result": [{"word": "cat", "conf": 0.60, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 1, 'the')
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')
        self.assertEqual(output['new_position'], 1)  # Position unchanged
        self.assertEqual(output['last_word'], 'the')  # Last word unchanged
    
    def test_process_short_duration_filtered(self):
        """Test that short duration words are filtered."""
        result = {
            "result": [{"word": "uh", "conf": 0.95, "start": 0.0, "end": 0.10}]
        }
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')
    
    def test_process_duplicate_filtered(self):
        """Test that consecutive duplicates are filtered."""
        result = {
            "result": [{"word": "the", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 1, 'the')
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')
        self.assertEqual(output['last_word'], 'the')  # Unchanged
    
    def test_process_omission(self):
        """Test processing an omission."""
        result = {
            "result": [{"word": "cat", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertEqual(output['accepted_word'], 'cat')
        self.assertEqual(output['miscue_type'], 'omission')
        self.assertEqual(output['new_position'], 2)
        self.assertEqual(output['last_word'], 'cat')
    
    def test_process_repetition(self):
        """Test processing a repetition."""
        result = {
            "result": [{"word": "the", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 1, 'cat')
        
        self.assertEqual(output['accepted_word'], 'the')
        self.assertEqual(output['miscue_type'], 'repetition')
        self.assertEqual(output['new_position'], 1)  # Position unchanged
        self.assertEqual(output['last_word'], 'the')
    
    def test_process_substitution(self):
        """Test processing a substitution."""
        result = {
            "result": [{"word": "bat", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 1, 'the')
        
        self.assertEqual(output['accepted_word'], 'bat')
        self.assertEqual(output['miscue_type'], 'substitution')
        self.assertEqual(output['new_position'], 2)
        self.assertEqual(output['last_word'], 'bat')
    
    def test_process_noise(self):
        """Test processing noise (no match)."""
        result = {
            "result": [{"word": "xyz", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')
        self.assertEqual(output['new_position'], 0)  # Position unchanged
        self.assertIsNone(output['last_word'])  # Unchanged
    
    def test_process_empty_result(self):
        """Test processing empty Vosk result."""
        result = {"result": []}
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')
    
    def test_process_empty_word(self):
        """Test processing result with empty word."""
        result = {
            "result": [{"word": "", "conf": 0.95, "start": 0.0, "end": 0.5}]
        }
        output = process_recognition_result(result, self.story, 0, None)
        
        self.assertIsNone(output['accepted_word'])
        self.assertEqual(output['miscue_type'], 'noise')


class TestConfiguration(unittest.TestCase):
    """Test configuration functions."""
    
    def test_configure_filter_thresholds(self):
        """Test configuring filter thresholds."""
        configure_filter_thresholds(min_confidence=0.80, min_duration=0.20)
        
        self.assertEqual(GhostWordFilter.MIN_CONFIDENCE, 0.80)
        self.assertEqual(GhostWordFilter.MIN_DURATION, 0.20)
        
        # Reset to defaults
        configure_filter_thresholds(min_confidence=0.75, min_duration=0.15)
    
    def test_get_filter_stats(self):
        """Test getting filter statistics."""
        stats = get_filter_stats()
        
        self.assertIn('min_confidence', stats)
        self.assertIn('min_duration', stats)
        self.assertIn('max_levenshtein_distance', stats)
        self.assertIn('repetition_lookback', stats)


class TestRealWorldScenarios(unittest.TestCase):
    """Test real-world reading session scenarios."""
    
    def setUp(self):
        """Set up test story."""
        self.story = ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"]
    
    def test_perfect_reading(self):
        """Test a perfect reading with no miscues."""
        position = 0
        last_word = None
        
        words_to_read = ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"]
        
        for word in words_to_read:
            result = {
                "result": [{"word": word, "conf": 0.95, "start": 0.0, "end": 0.5}]
            }
            output = process_recognition_result(result, self.story, position, last_word)
            
            self.assertEqual(output['miscue_type'], 'correct')
            position = output['new_position']
            last_word = output['last_word']
        
        self.assertEqual(position, len(self.story))
    
    def test_reading_with_ghost_words(self):
        """Test reading with ghost words that should be filtered."""
        position = 0
        last_word = None
        
        # Sequence: correct word, ghost (low conf), correct word, ghost (short duration)
        sequence = [
            ({"word": "the", "conf": 0.95, "start": 0.0, "end": 0.5}, True),  # Accept
            ({"word": "uh", "conf": 0.60, "start": 0.5, "end": 0.8}, False),  # Filter (low conf)
            ({"word": "quick", "conf": 0.92, "start": 1.0, "end": 1.5}, True),  # Accept
            ({"word": "the", "conf": 0.95, "start": 1.5, "end": 1.55}, False),  # Filter (short)
        ]
        
        for word_data, should_accept in sequence:
            result = {"result": [word_data]}
            output = process_recognition_result(result, self.story, position, last_word)
            
            if should_accept:
                self.assertIsNotNone(output['accepted_word'])
                position = output['new_position']
                last_word = output['last_word']
            else:
                self.assertIsNone(output['accepted_word'])
        
        self.assertEqual(position, 2)  # Should have advanced 2 positions
    
    def test_reading_with_miscues(self):
        """Test reading with various miscue types."""
        position = 0
        last_word = None
        
        # Sequence with different miscue types
        sequence = [
            ("the", "correct"),
            ("quack", "substitution"),  # Similar to "quick"
            ("fox", "omission"),  # Skipped "brown"
            ("jumps", "correct"),
        ]
        
        for word, expected_type in sequence:
            result = {
                "result": [{"word": word, "conf": 0.95, "start": 0.0, "end": 0.5}]
            }
            output = process_recognition_result(result, self.story, position, last_word)
            
            self.assertEqual(output['miscue_type'], expected_type)
            position = output['new_position']
            last_word = output['last_word']


if __name__ == '__main__':
    unittest.main(verbosity=2)
