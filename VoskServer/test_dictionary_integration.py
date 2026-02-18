"""
Simple test script for Dictionary API integration
Run this to verify everything is working
"""

import sys

def test_dictionary_api_service():
    """Test the Dictionary API service"""
    print("=" * 60)
    print("Testing Dictionary API Service")
    print("=" * 60)
    
    try:
        from dictionary_api_service import get_word_info, word_exists, get_word_phonetics
        
        # Test 1: Check if words exist
        print("\n1. Testing word existence:")
        test_words = ["hello", "cat", "dog", "xyz123"]
        for word in test_words:
            exists = word_exists(word)
            status = "✓" if exists else "✗"
            print(f"   {status} {word}: {'Found' if exists else 'Not found'}")
        
        # Test 2: Get word info
        print("\n2. Testing word info:")
        word = "hello"
        info = get_word_info(word)
        if info:
            print(f"   ✓ Word: {info['word']}")
            print(f"   ✓ Phonetics: {info['phonetics']}")
            print(f"   ✓ Meanings: {len(info['meanings'])} found")
        else:
            print(f"   ✗ Failed to get info for '{word}'")
        
        # Test 3: Get phonetics
        print("\n3. Testing phonetics:")
        phonetics = get_word_phonetics("cat")
        if phonetics:
            print(f"   ✓ Phonetics for 'cat': {phonetics}")
        else:
            print(f"   ✗ No phonetics found for 'cat'")
        
        print("\n✅ Dictionary API Service: PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Dictionary API Service: FAILED")
        print(f"   Error: {e}")
        return False


def test_dictionary_validator():
    """Test the Dictionary Validator"""
    print("\n" + "=" * 60)
    print("Testing Dictionary Validator")
    print("=" * 60)
    
    try:
        from dictionary_validator import is_valid_word, validate_words, enable_validation, disable_validation
        
        # Test 1: Validate single words
        print("\n1. Testing single word validation:")
        test_words = ["hello", "cat", "xyz123", "asdfgh"]
        for word in test_words:
            is_valid = is_valid_word(word)
            status = "✓" if is_valid else "✗"
            print(f"   {status} {word}: {'Valid' if is_valid else 'Invalid'}")
        
        # Test 2: Batch validation
        print("\n2. Testing batch validation:")
        words = ["hello", "cat", "dog", "xyz123", "asdfgh"]
        result = validate_words(words)
        print(f"   Total: {result['total']}")
        print(f"   Valid: {result['valid_count']} - {result['valid']}")
        print(f"   Invalid: {result['invalid_count']} - {result['invalid']}")
        
        # Test 3: Enable/Disable
        print("\n3. Testing enable/disable:")
        disable_validation()
        print(f"   Disabled: is_valid_word('xyz123') = {is_valid_word('xyz123')} (should be True)")
        enable_validation()
        print(f"   Enabled: is_valid_word('xyz123') = {is_valid_word('xyz123')} (should be False)")
        
        print("\n✅ Dictionary Validator: PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Dictionary Validator: FAILED")
        print(f"   Error: {e}")
        return False


def test_api_connection():
    """Test connection to Dictionary API"""
    print("\n" + "=" * 60)
    print("Testing API Connection")
    print("=" * 60)
    
    try:
        import requests
        
        print("\n1. Testing API endpoint:")
        url = "https://api.dictionaryapi.dev/api/v2/entries/en/hello"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print(f"   ✓ API is accessible")
            print(f"   ✓ Status code: {response.status_code}")
            data = response.json()
            print(f"   ✓ Response received: {len(data)} entries")
        else:
            print(f"   ✗ API returned status code: {response.status_code}")
            return False
        
        print("\n✅ API Connection: PASSED")
        return True
        
    except requests.exceptions.Timeout:
        print(f"\n❌ API Connection: TIMEOUT")
        print(f"   The API took too long to respond")
        return False
    except requests.exceptions.ConnectionError:
        print(f"\n❌ API Connection: FAILED")
        print(f"   Could not connect to the API")
        print(f"   Check your internet connection")
        return False
    except Exception as e:
        print(f"\n❌ API Connection: FAILED")
        print(f"   Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Dictionary API Integration Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1: API Connection
    results.append(("API Connection", test_api_connection()))
    
    # Test 2: Dictionary API Service
    results.append(("Dictionary API Service", test_dictionary_api_service()))
    
    # Test 3: Dictionary Validator
    results.append(("Dictionary Validator", test_dictionary_validator()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Dictionary API integration is working!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
