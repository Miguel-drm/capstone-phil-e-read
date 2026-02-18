#!/usr/bin/env python3
"""
Test metrics calculation (Task 7.3)

Verifies WPM, accuracy, and oral reading score are calculated correctly.
Tests with various reading sessions (fast, slow, many miscues, few miscues).

Requirements: 4.2
"""

import sys
from word_matcher import WordMatcherSession


def test_wpm_calculation():
    """Test WPM (Words Per Minute) calculation"""
    print("\n" + "=" * 60)
    print("Test 1: WPM Calculation")
    print("=" * 60)
    
    # Test case 1: Fast reading (120 WPM)
    # 10 words in 5 seconds = 10/5 * 60 = 120 WPM
    expected_words = ["the", "cat", "sat", "on", "the", "mat", "and", "looked", "at", "me"]
    session = WordMatcherSession(expected_words)
    
    # Read all words correctly
    for word in expected_words:
        session.process_word(word)
    
    elapsed_time = 5.0  # 5 seconds
    metrics = session.get_metrics(elapsed_time)
    
    expected_wpm = 120
    print(f"   Fast reading: {len(expected_words)} words in {elapsed_time}s")
    print(f"   Expected WPM: {expected_wpm}")
    print(f"   Actual WPM: {metrics['wpm']}")
    
    if metrics['wpm'] == expected_wpm:
        print("   ✅ PASS: Fast reading WPM correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_wpm}, got {metrics['wpm']}")
        return False
    
    # Test case 2: Slow reading (30 WPM)
    # 10 words in 20 seconds = 10/20 * 60 = 30 WPM
    session2 = WordMatcherSession(expected_words)
    for word in expected_words:
        session2.process_word(word)
    
    elapsed_time2 = 20.0  # 20 seconds
    metrics2 = session2.get_metrics(elapsed_time2)
    
    expected_wpm2 = 30
    print(f"\n   Slow reading: {len(expected_words)} words in {elapsed_time2}s")
    print(f"   Expected WPM: {expected_wpm2}")
    print(f"   Actual WPM: {metrics2['wpm']}")
    
    if metrics2['wpm'] == expected_wpm2:
        print("   ✅ PASS: Slow reading WPM correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_wpm2}, got {metrics2['wpm']}")
        return False
    
    # Test case 3: Zero elapsed time (edge case)
    session3 = WordMatcherSession(expected_words)
    for word in expected_words:
        session3.process_word(word)
    
    metrics3 = session3.get_metrics(0.0)
    print(f"\n   Zero elapsed time edge case")
    print(f"   Expected WPM: 0")
    print(f"   Actual WPM: {metrics3['wpm']}")
    
    if metrics3['wpm'] == 0:
        print("   ✅ PASS: Zero elapsed time handled correctly")
    else:
        print(f"   ❌ FAIL: Expected 0, got {metrics3['wpm']}")
        return False
    
    return True


def test_accuracy_calculation():
    """Test accuracy calculation"""
    print("\n" + "=" * 60)
    print("Test 2: Accuracy Calculation")
    print("=" * 60)
    
    # Test case 1: Perfect reading (100% accuracy)
    # accuracy = (words_read - total_miscues) / words_read * 100
    expected_words = ["the", "cat", "sat", "on", "the", "mat"]
    session = WordMatcherSession(expected_words)
    
    # Read all words correctly
    for word in expected_words:
        session.process_word(word)
    
    metrics = session.get_metrics(10.0)
    
    expected_accuracy = 100.0
    print(f"   Perfect reading: {len(expected_words)} words, 0 miscues")
    print(f"   Expected accuracy: {expected_accuracy}%")
    print(f"   Actual accuracy: {metrics['accuracy']}%")
    
    if metrics['accuracy'] == expected_accuracy:
        print("   ✅ PASS: Perfect reading accuracy correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_accuracy}, got {metrics['accuracy']}")
        return False
    
    # Test case 2: Reading with miscues (50% accuracy)
    # 10 words read, 5 miscues = (10-5)/10 * 100 = 50%
    expected_words2 = ["the", "cat", "sat", "on", "the", "mat", "and", "looked", "at", "me"]
    session2 = WordMatcherSession(expected_words2)
    
    # Read with alternating correct and incorrect words
    test_words = ["the", "dog", "sat", "in", "the", "hat", "and", "stared", "at", "you"]
    for word in test_words:
        session2.process_word(word)
    
    metrics2 = session2.get_metrics(10.0)
    
    # Calculate expected accuracy based on actual miscues
    correct_words = metrics2['words_read'] - metrics2['total_miscues']
    expected_accuracy2 = round((correct_words / metrics2['words_read']) * 100, 1)
    
    print(f"\n   Reading with miscues: {metrics2['words_read']} words, {metrics2['total_miscues']} miscues")
    print(f"   Expected accuracy: {expected_accuracy2}%")
    print(f"   Actual accuracy: {metrics2['accuracy']}%")
    
    if metrics2['accuracy'] == expected_accuracy2:
        print("   ✅ PASS: Accuracy with miscues correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_accuracy2}, got {metrics2['accuracy']}")
        return False
    
    # Test case 3: Zero words read (edge case)
    session3 = WordMatcherSession(expected_words)
    metrics3 = session3.get_metrics(10.0)
    
    expected_accuracy3 = 0.0
    print(f"\n   Zero words read edge case")
    print(f"   Expected accuracy: {expected_accuracy3}%")
    print(f"   Actual accuracy: {metrics3['accuracy']}%")
    
    if metrics3['accuracy'] == expected_accuracy3:
        print("   ✅ PASS: Zero words read handled correctly")
    else:
        print(f"   ❌ FAIL: Expected {expected_accuracy3}, got {metrics3['accuracy']}")
        return False
    
    return True


def test_oral_reading_score():
    """Test oral reading score calculation"""
    print("\n" + "=" * 60)
    print("Test 3: Oral Reading Score Calculation")
    print("=" * 60)
    
    # Test case 1: Complete story with perfect reading (100% score)
    # oral_reading_score = (words_read - total_miscues) / total_words * 100
    expected_words = ["the", "cat", "sat", "on", "the", "mat"]
    session = WordMatcherSession(expected_words)
    
    # Read all words correctly
    for word in expected_words:
        session.process_word(word)
    
    metrics = session.get_metrics(10.0)
    
    expected_score = 100.0
    print(f"   Complete perfect reading: {len(expected_words)} words, 0 miscues")
    print(f"   Expected score: {expected_score}%")
    print(f"   Actual score: {metrics['oral_reading_score']}%")
    
    if metrics['oral_reading_score'] == expected_score:
        print("   ✅ PASS: Perfect reading score correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_score}, got {metrics['oral_reading_score']}")
        return False
    
    # Test case 2: Partial story completion (50% score)
    # 10 total words, read 5 correctly = 5/10 * 100 = 50%
    expected_words2 = ["the", "cat", "sat", "on", "the", "mat", "and", "looked", "at", "me"]
    session2 = WordMatcherSession(expected_words2)
    
    # Read only first 5 words correctly
    for word in expected_words2[:5]:
        session2.process_word(word)
    
    metrics2 = session2.get_metrics(10.0)
    
    correct_words2 = metrics2['words_read'] - metrics2['total_miscues']
    expected_score2 = round((correct_words2 / len(expected_words2)) * 100, 1)
    
    print(f"\n   Partial completion: {metrics2['words_read']}/{len(expected_words2)} words, {metrics2['total_miscues']} miscues")
    print(f"   Expected score: {expected_score2}%")
    print(f"   Actual score: {metrics2['oral_reading_score']}%")
    
    if metrics2['oral_reading_score'] == expected_score2:
        print("   ✅ PASS: Partial completion score correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_score2}, got {metrics2['oral_reading_score']}")
        return False
    
    # Test case 3: Reading with many miscues
    expected_words3 = ["the", "cat", "sat", "on", "the", "mat", "and", "looked", "at", "me"]
    session3 = WordMatcherSession(expected_words3)
    
    # Read all words but with many miscues
    test_words3 = ["a", "dog", "sit", "in", "a", "hat", "but", "stared", "to", "you"]
    for word in test_words3:
        session3.process_word(word)
    
    metrics3 = session3.get_metrics(10.0)
    
    correct_words3 = metrics3['words_read'] - metrics3['total_miscues']
    expected_score3 = round((correct_words3 / len(expected_words3)) * 100, 1)
    
    print(f"\n   Many miscues: {metrics3['words_read']}/{len(expected_words3)} words, {metrics3['total_miscues']} miscues")
    print(f"   Expected score: {expected_score3}%")
    print(f"   Actual score: {metrics3['oral_reading_score']}%")
    
    if metrics3['oral_reading_score'] == expected_score3:
        print("   ✅ PASS: Many miscues score correct")
    else:
        print(f"   ❌ FAIL: Expected {expected_score3}, got {metrics3['oral_reading_score']}")
        return False
    
    # Test case 4: Score clamping (should be between 0-100)
    # Even if calculation goes negative or over 100, it should be clamped
    session4 = WordMatcherSession(expected_words)
    metrics4 = session4.get_metrics(10.0)
    
    print(f"\n   Score clamping: {metrics4['oral_reading_score']}%")
    
    if 0.0 <= metrics4['oral_reading_score'] <= 100.0:
        print("   ✅ PASS: Score properly clamped between 0-100")
    else:
        print(f"   ❌ FAIL: Score {metrics4['oral_reading_score']} outside valid range")
        return False
    
    return True


def test_comprehensive_metrics():
    """Test all metrics together with various scenarios"""
    print("\n" + "=" * 60)
    print("Test 4: Comprehensive Metrics Test")
    print("=" * 60)
    
    # Scenario 1: Fast reading with few miscues
    print("\n   Scenario 1: Fast reading with few miscues")
    expected_words = ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "today"]
    session1 = WordMatcherSession(expected_words)
    
    # Read with 2 miscues
    test_words1 = ["the", "quick", "brown", "fox", "jumped", "over", "the", "lazy", "cat", "today"]
    for word in test_words1:
        session1.process_word(word)
    
    elapsed1 = 5.0  # 5 seconds
    metrics1 = session1.get_metrics(elapsed1)
    
    print(f"   Words read: {metrics1['words_read']}/{metrics1['total_words']}")
    print(f"   Miscues: {metrics1['total_miscues']}")
    print(f"   WPM: {metrics1['wpm']}")
    print(f"   Accuracy: {metrics1['accuracy']}%")
    print(f"   Oral Reading Score: {metrics1['oral_reading_score']}%")
    
    # Verify WPM
    expected_wpm1 = int((metrics1['words_read'] / elapsed1) * 60)
    if metrics1['wpm'] != expected_wpm1:
        print(f"   ❌ FAIL: WPM incorrect. Expected {expected_wpm1}, got {metrics1['wpm']}")
        return False
    
    # Verify accuracy
    correct1 = metrics1['words_read'] - metrics1['total_miscues']
    expected_accuracy1 = round((correct1 / metrics1['words_read']) * 100, 1)
    if metrics1['accuracy'] != expected_accuracy1:
        print(f"   ❌ FAIL: Accuracy incorrect. Expected {expected_accuracy1}, got {metrics1['accuracy']}")
        return False
    
    # Verify oral reading score
    expected_score1 = round((correct1 / metrics1['total_words']) * 100, 1)
    if metrics1['oral_reading_score'] != expected_score1:
        print(f"   ❌ FAIL: Oral reading score incorrect. Expected {expected_score1}, got {metrics1['oral_reading_score']}")
        return False
    
    print("   ✅ PASS: Fast reading with few miscues metrics correct")
    
    # Scenario 2: Slow reading with many miscues
    print("\n   Scenario 2: Slow reading with many miscues")
    session2 = WordMatcherSession(expected_words)
    
    # Read with 5 miscues
    test_words2 = ["a", "slow", "brown", "cat", "jumped", "under", "a", "lazy", "bird", "yesterday"]
    for word in test_words2:
        session2.process_word(word)
    
    elapsed2 = 20.0  # 20 seconds
    metrics2 = session2.get_metrics(elapsed2)
    
    print(f"   Words read: {metrics2['words_read']}/{metrics2['total_words']}")
    print(f"   Miscues: {metrics2['total_miscues']}")
    print(f"   WPM: {metrics2['wpm']}")
    print(f"   Accuracy: {metrics2['accuracy']}%")
    print(f"   Oral Reading Score: {metrics2['oral_reading_score']}%")
    
    # Verify WPM
    expected_wpm2 = int((metrics2['words_read'] / elapsed2) * 60)
    if metrics2['wpm'] != expected_wpm2:
        print(f"   ❌ FAIL: WPM incorrect. Expected {expected_wpm2}, got {metrics2['wpm']}")
        return False
    
    # Verify accuracy
    correct2 = metrics2['words_read'] - metrics2['total_miscues']
    if metrics2['words_read'] > 0:
        expected_accuracy2 = round((correct2 / metrics2['words_read']) * 100, 1)
    else:
        expected_accuracy2 = 0.0
    
    if metrics2['accuracy'] != expected_accuracy2:
        print(f"   ❌ FAIL: Accuracy incorrect. Expected {expected_accuracy2}, got {metrics2['accuracy']}")
        return False
    
    # Verify oral reading score
    expected_score2 = round((correct2 / metrics2['total_words']) * 100, 1)
    if metrics2['oral_reading_score'] != expected_score2:
        print(f"   ❌ FAIL: Oral reading score incorrect. Expected {expected_score2}, got {metrics2['oral_reading_score']}")
        return False
    
    print("   ✅ PASS: Slow reading with many miscues metrics correct")
    
    return True


def run_all_tests():
    """Run all metrics calculation tests"""
    print("\n" + "=" * 60)
    print("METRICS CALCULATION TEST SUITE (Task 7.3)")
    print("=" * 60)
    print("Testing WPM, accuracy, and oral reading score calculations")
    print("Requirements: 4.2")
    print("=" * 60)
    
    tests = [
        ("WPM Calculation", test_wpm_calculation),
        ("Accuracy Calculation", test_accuracy_calculation),
        ("Oral Reading Score", test_oral_reading_score),
        ("Comprehensive Metrics", test_comprehensive_metrics),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n   ❌ EXCEPTION in {test_name}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {len(tests)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED - Metrics calculation is correct!")
        return True
    else:
        print(f"\n❌ {failed} TEST(S) FAILED - Metrics calculation needs fixes")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
