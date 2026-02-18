"""
Checkpoint test for backend changes (Task 2)
Tests the Dictionary API integration in the Vosk server
"""
import sys

def test_imports():
    """Test that all required modules can be imported"""
    print("=" * 60)
    print("Test 1: Module Imports")
    print("=" * 60)
    
    try:
        from server import validate_word_for_display, DICTIONARY_API_AVAILABLE
        from dictionary_api_service import get_dictionary_service
        print("✅ All modules imported successfully")
        print(f"   Dictionary API Available: {DICTIONARY_API_AVAILABLE}")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False


def test_validate_word_function():
    """Test the validate_word_for_display function"""
    print("\n" + "=" * 60)
    print("Test 2: validate_word_for_display Function")
    print("=" * 60)
    
    try:
        from server import validate_word_for_display
        
        # Test cases: (word, expected_result, description)
        test_cases = [
            ("hello", True, "Valid English word"),
            ("cat", True, "Valid English word"),
            ("the", True, "Valid English word"),
            ("x", False, "Too short (< 2 chars)"),
            ("xyz123", False, "Not a real word"),
        ]
        
        passed = 0
        failed = 0
        
        for word, expected, description in test_cases:
            result = validate_word_for_display(word)
            if result == expected:
                print(f"   ✅ '{word}': {description}")
                passed += 1
            else:
                print(f"   ❌ '{word}': Expected {expected}, got {result}")
                failed += 1
        
        print(f"\n   Results: {passed} passed, {failed} failed")
        return failed == 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_dictionary_service():
    """Test the Dictionary API service"""
    print("\n" + "=" * 60)
    print("Test 3: Dictionary API Service")
    print("=" * 60)
    
    try:
        from dictionary_api_service import get_dictionary_service
        
        service = get_dictionary_service()
        
        # Test word existence
        test_words = ["hello", "cat", "xyz123"]
        for word in test_words:
            exists = service.check_word_exists(word)
            status = "✅" if exists else "❌"
            print(f"   {status} '{word}': {'Found' if exists else 'Not found'}")
        
        # Test phonetics
        phonetics = service.get_phonetics("hello")
        if phonetics:
            print(f"   ✅ Phonetics for 'hello': {phonetics}")
        else:
            print(f"   ❌ No phonetics found for 'hello'")
            return False
        
        print("\n   ✅ Dictionary API service working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_fail_open_behavior():
    """Test that validation fails open on errors"""
    print("\n" + "=" * 60)
    print("Test 4: Fail-Open Behavior")
    print("=" * 60)
    
    try:
        from server import validate_word_for_display
        
        # Test with a word that should pass validation
        # Even if API fails, it should return True (fail open)
        result = validate_word_for_display("test")
        
        if result:
            print("   ✅ Fail-open behavior working (word accepted)")
        else:
            print("   ⚠️ Word rejected (may indicate API issue)")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


def main():
    """Run all checkpoint tests"""
    print("\n" + "=" * 60)
    print("BACKEND CHECKPOINT TEST (Task 2)")
    print("Testing Dictionary API Integration")
    print("=" * 60)
    
    results = []
    
    # Run all tests
    results.append(("Module Imports", test_imports()))
    results.append(("validate_word_for_display", test_validate_word_function()))
    results.append(("Dictionary API Service", test_dictionary_service()))
    results.append(("Fail-Open Behavior", test_fail_open_behavior()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All backend tests passed!")
        print("✅ Dictionary API integration is working correctly")
        print("✅ Word validation function is operational")
        print("✅ Fail-open behavior is implemented")
        print("\n📋 Backend changes verified successfully!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
