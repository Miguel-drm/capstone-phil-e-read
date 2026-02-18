"""
Test script to verify fail-open behavior for Dictionary API errors
Tests requirement 5.1: WHEN Dictionary_API is unavailable, THE System SHALL continue operating with reduced filtering (fail-open)
"""
import sys
import unittest
from unittest.mock import patch, MagicMock

# Import the function to test
from server import validate_word_for_display, DICTIONARY_API_AVAILABLE


class TestFailOpenBehavior(unittest.TestCase):
    """Test cases for fail-open behavior when Dictionary API fails"""
    
    def test_normal_operation_valid_word(self):
        """Test that valid words pass validation when API is working"""
        result = validate_word_for_display("hello")
        self.assertTrue(result, "Valid word should pass validation")
    
    def test_normal_operation_short_word(self):
        """Test that very short words are rejected (< 2 chars)"""
        result = validate_word_for_display("x")
        self.assertFalse(result, "Single character should be rejected")
    
    @patch('server.DICTIONARY_API_AVAILABLE', True)
    @patch('server.get_dictionary_service')
    def test_fail_open_on_api_exception(self, mock_get_service):
        """Test that words are accepted when API throws an exception"""
        # Mock the dictionary service to raise an exception
        mock_service = MagicMock()
        mock_service.check_word_exists.side_effect = Exception("API connection failed")
        mock_get_service.return_value = mock_service
        
        # Word should be accepted despite API failure (fail-open)
        result = validate_word_for_display("test")
        self.assertTrue(result, "Word should be accepted when API fails (fail-open)")
    
    @patch('server.DICTIONARY_API_AVAILABLE', True)
    @patch('server.get_dictionary_service')
    def test_fail_open_on_timeout(self, mock_get_service):
        """Test that words are accepted when API times out"""
        # Mock the dictionary service to raise a timeout exception
        mock_service = MagicMock()
        mock_service.check_word_exists.side_effect = TimeoutError("API request timed out")
        mock_get_service.return_value = mock_service
        
        # Word should be accepted despite timeout (fail-open)
        result = validate_word_for_display("timeout")
        self.assertTrue(result, "Word should be accepted when API times out (fail-open)")
    
    @patch('server.DICTIONARY_API_AVAILABLE', True)
    @patch('server.get_dictionary_service')
    def test_fail_open_on_network_error(self, mock_get_service):
        """Test that words are accepted when network error occurs"""
        # Mock the dictionary service to raise a network error
        mock_service = MagicMock()
        mock_service.check_word_exists.side_effect = ConnectionError("Network unreachable")
        mock_get_service.return_value = mock_service
        
        # Word should be accepted despite network error (fail-open)
        result = validate_word_for_display("network")
        self.assertTrue(result, "Word should be accepted when network fails (fail-open)")
    
    @patch('server.DICTIONARY_API_AVAILABLE', False)
    def test_fail_open_when_api_unavailable(self):
        """Test that words are accepted when Dictionary API is not available"""
        # When DICTIONARY_API_AVAILABLE is False, all words (except too short) should pass
        result = validate_word_for_display("anyword")
        self.assertTrue(result, "Word should be accepted when API is unavailable (fail-open)")
    
    @patch('server.DICTIONARY_API_AVAILABLE', True)
    @patch('server.get_dictionary_service')
    def test_fail_open_on_invalid_response(self, mock_get_service):
        """Test that words are accepted when API returns invalid response"""
        # Mock the dictionary service to return None or invalid data
        mock_service = MagicMock()
        mock_service.check_word_exists.side_effect = ValueError("Invalid API response")
        mock_get_service.return_value = mock_service
        
        # Word should be accepted despite invalid response (fail-open)
        result = validate_word_for_display("invalid")
        self.assertTrue(result, "Word should be accepted when API returns invalid response (fail-open)")
    
    def test_short_words_rejected_even_on_fail_open(self):
        """Test that very short words are still rejected even in fail-open mode"""
        # Short words should be rejected before API check
        result = validate_word_for_display("a")
        self.assertFalse(result, "Single character should be rejected even in fail-open mode")


def run_manual_tests():
    """Run manual tests with simulated failures"""
    print("\n" + "=" * 70)
    print("MANUAL FAIL-OPEN BEHAVIOR TESTS")
    print("=" * 70)
    
    print("\n1. Testing normal operation...")
    result = validate_word_for_display("hello")
    print(f"   Result: {'✅ PASS' if result else '❌ FAIL'} - Valid word accepted")
    
    print("\n2. Testing short word rejection...")
    result = validate_word_for_display("x")
    print(f"   Result: {'✅ PASS' if not result else '❌ FAIL'} - Short word rejected")
    
    print("\n3. Simulating API failure...")
    with patch('server.DICTIONARY_API_AVAILABLE', True):
        with patch('server.get_dictionary_service') as mock_service:
            mock = MagicMock()
            mock.check_word_exists.side_effect = Exception("Simulated API failure")
            mock_service.return_value = mock
            
            result = validate_word_for_display("test")
            print(f"   Result: {'✅ PASS' if result else '❌ FAIL'} - Word accepted despite API failure")
    
    print("\n4. Simulating API unavailable...")
    with patch('server.DICTIONARY_API_AVAILABLE', False):
        result = validate_word_for_display("anyword")
        print(f"   Result: {'✅ PASS' if result else '❌ FAIL'} - Word accepted when API unavailable")
    
    print("\n" + "=" * 70)
    print("MANUAL TESTS COMPLETED")
    print("=" * 70)


def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("FAIL-OPEN BEHAVIOR TEST SUITE")
    print("Testing Requirement 5.1: Dictionary API Fail-Open")
    print("=" * 70)
    print(f"\nDictionary API Available: {DICTIONARY_API_AVAILABLE}")
    
    # Run unit tests
    print("\n" + "=" * 70)
    print("RUNNING UNIT TESTS")
    print("=" * 70)
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestFailOpenBehavior)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Run manual tests
    run_manual_tests()
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    if result.wasSuccessful():
        print("✅ All unit tests passed!")
        print("✅ Fail-open behavior is correctly implemented")
        print("✅ System continues operating when Dictionary API fails")
        print("\n📋 Requirement 5.1 verified successfully!")
        return 0
    else:
        print(f"❌ {len(result.failures)} test(s) failed")
        print(f"❌ {len(result.errors)} test(s) had errors")
        return 1


if __name__ == "__main__":
    sys.exit(main())
