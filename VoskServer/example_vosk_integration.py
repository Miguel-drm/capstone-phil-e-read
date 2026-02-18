"""
Simple example of integrating Dictionary API with Vosk
Shows how to validate recognized words
"""

from dictionary_validator import is_valid_word, validate_words

def process_vosk_result(recognized_text):
    """
    Process text recognized by Vosk
    Validates words using Dictionary API
    
    Args:
        recognized_text: Text recognized by Vosk (e.g., "hello world")
        
    Returns:
        Dictionary with valid and invalid words
    """
    # Split into words
    words = recognized_text.split()
    
    # Validate all words
    result = validate_words(words)
    
    # Log results
    print(f"\nRecognized: {recognized_text}")
    print(f"Valid words: {result['valid']}")
    print(f"Invalid words: {result['invalid']}")
    
    return result


def filter_valid_words(recognized_text):
    """
    Filter recognized text to only include valid words
    
    Args:
        recognized_text: Text recognized by Vosk
        
    Returns:
        String with only valid words
    """
    words = recognized_text.split()
    valid_words = [word for word in words if is_valid_word(word)]
    return ' '.join(valid_words)


def example_1_simple_validation():
    """Example 1: Simple word validation"""
    print("\n" + "=" * 60)
    print("Example 1: Simple Word Validation")
    print("=" * 60)
    
    # Simulate Vosk recognition
    recognized_words = ["hello", "cat", "xyz123", "dog"]
    
    print("\nValidating words one by one:")
    for word in recognized_words:
        is_valid = is_valid_word(word)
        status = "✓ Valid" if is_valid else "✗ Invalid"
        print(f"  {word}: {status}")


def example_2_batch_validation():
    """Example 2: Batch validation"""
    print("\n" + "=" * 60)
    print("Example 2: Batch Validation")
    print("=" * 60)
    
    # Simulate Vosk recognition
    recognized_text = "hello cat xyz123 dog asdfgh"
    
    print(f"\nRecognized text: {recognized_text}")
    
    # Validate all words at once
    result = process_vosk_result(recognized_text)
    
    print(f"\nSummary:")
    print(f"  Total words: {result['total']}")
    print(f"  Valid: {result['valid_count']}")
    print(f"  Invalid: {result['invalid_count']}")


def example_3_filtering():
    """Example 3: Filter to only valid words"""
    print("\n" + "=" * 60)
    print("Example 3: Filtering Valid Words")
    print("=" * 60)
    
    # Simulate Vosk recognition with noise
    recognized_text = "hello xyz cat abc dog qwerty"
    
    print(f"\nOriginal text: {recognized_text}")
    
    # Filter to only valid words
    filtered_text = filter_valid_words(recognized_text)
    
    print(f"Filtered text: {filtered_text}")


def example_4_story_validation():
    """Example 4: Validate story words"""
    print("\n" + "=" * 60)
    print("Example 4: Story Word Validation")
    print("=" * 60)
    
    # Story vocabulary
    story_words = ["the", "cat", "sat", "on", "mat"]
    
    print(f"\nStory vocabulary: {story_words}")
    
    # Validate story words
    result = validate_words(story_words)
    
    if result['invalid_count'] == 0:
        print("✓ All story words are valid!")
    else:
        print(f"⚠ {result['invalid_count']} invalid words found:")
        print(f"  {result['invalid']}")


def example_5_real_time_processing():
    """Example 5: Real-time word processing"""
    print("\n" + "=" * 60)
    print("Example 5: Real-time Processing")
    print("=" * 60)
    
    # Simulate real-time Vosk recognition
    word_stream = ["hello", "xyz", "cat", "abc", "dog"]
    
    print("\nProcessing words in real-time:")
    valid_count = 0
    invalid_count = 0
    
    for word in word_stream:
        is_valid = is_valid_word(word)
        
        if is_valid:
            print(f"  ✓ {word} - ACCEPTED")
            valid_count += 1
        else:
            print(f"  ✗ {word} - REJECTED")
            invalid_count += 1
    
    print(f"\nResults:")
    print(f"  Accepted: {valid_count}")
    print(f"  Rejected: {invalid_count}")


def main():
    """Run all examples"""
    print("\n" + "=" * 60)
    print("Dictionary API + Vosk Integration Examples")
    print("=" * 60)
    
    # Run examples
    example_1_simple_validation()
    example_2_batch_validation()
    example_3_filtering()
    example_4_story_validation()
    example_5_real_time_processing()
    
    print("\n" + "=" * 60)
    print("Examples Complete!")
    print("=" * 60)
    print("\nThese examples show how to:")
    print("  1. Validate individual words")
    print("  2. Validate multiple words at once")
    print("  3. Filter out invalid words")
    print("  4. Validate story vocabulary")
    print("  5. Process words in real-time")
    print("\nIntegrate these patterns into your Vosk server!")


if __name__ == "__main__":
    main()
