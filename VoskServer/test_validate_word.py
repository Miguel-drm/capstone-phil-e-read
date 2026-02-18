"""
Test script for validate_word_for_display function
"""
import sys
sys.path.insert(0, '.')

from server import validate_word_for_display, DICTIONARY_API_AVAILABLE

def test_validate_word_for_display():
    """Test the validate_word_for_display function"""
    print("=" * 60)
    print("Testing validate_word_for_display function")
    print("=" * 60)
    print(f"Dictionary API Available: {DICTIONARY_API_AVAILABLE}")
    print()
    
    # Test cases
    test_cases = [
        ("hello", True, "Valid English word"),
        ("cat", True, "Valid English word"),
        ("the", True, "Valid English word"),
        ("x", False, "Too short (< 2 chars)"),
        ("a", False, "Too short (< 2 chars)"),
        ("xyz123", False, "Not a real word"),
        ("asdfgh", False, "Not a real word"),
    ]
    
    print("Running test cases:")
    print("-" * 60)
    
    passed = 0
    failed = 0
    
    for word, expected, description in test_cases:
        print(f"\nTest: '{word}' - {description}")
        print(f"Expected: {expected}")
        
        try:
            result = validate_word_for_display(word)
            print(f"Result: {result}")
            
            if result == expected:
                print("✅ PASS")
                passed += 1
            else:
                print("❌ FAIL")
                failed += 1
        except Exception as e:
            print(f"❌ ERROR: {e}")
            failed += 1
    
    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0

if __name__ == "__main__":
    success = test_validate_word_for_display()
    sys.exit(0 if success else 1)
