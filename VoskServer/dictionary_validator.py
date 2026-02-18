"""
Simple Dictionary Validator
Uses Dictionary API to validate if spoken words are real English words
Clean and straightforward implementation
"""

from dictionary_api_service import get_dictionary_service

class DictionaryValidator:
    """Simple validator that checks words against Dictionary API"""
    
    def __init__(self):
        self.dictionary = get_dictionary_service()
        self.enabled = True
    
    def is_valid_word(self, word: str) -> bool:
        """
        Check if a word is valid using Dictionary API
        
        Args:
            word: The word to validate
            
        Returns:
            True if word exists in dictionary, False otherwise
        """
        if not self.enabled:
            return True  # If disabled, accept all words
        
        if not word or len(word) < 2:
            return False  # Too short
        
        # Check dictionary
        return self.dictionary.check_word_exists(word)
    
    def validate_words(self, words: list) -> dict:
        """
        Validate a list of words
        
        Args:
            words: List of words to validate
            
        Returns:
            Dictionary with valid and invalid words
        """
        valid = []
        invalid = []
        
        for word in words:
            if self.is_valid_word(word):
                valid.append(word)
            else:
                invalid.append(word)
        
        return {
            'valid': valid,
            'invalid': invalid,
            'total': len(words),
            'valid_count': len(valid),
            'invalid_count': len(invalid)
        }
    
    def enable(self):
        """Enable dictionary validation"""
        self.enabled = True
    
    def disable(self):
        """Disable dictionary validation"""
        self.enabled = False


# Global instance
_validator = None

def get_validator() -> DictionaryValidator:
    """Get or create the global validator instance"""
    global _validator
    if _validator is None:
        _validator = DictionaryValidator()
    return _validator


# Simple helper functions
def is_valid_word(word: str) -> bool:
    """Check if a word is valid"""
    validator = get_validator()
    return validator.is_valid_word(word)


def validate_words(words: list) -> dict:
    """Validate a list of words"""
    validator = get_validator()
    return validator.validate_words(words)


def enable_validation():
    """Enable dictionary validation"""
    validator = get_validator()
    validator.enable()


def disable_validation():
    """Disable dictionary validation"""
    validator = get_validator()
    validator.disable()


# Test function
if __name__ == "__main__":
    # Test the validator
    validator = DictionaryValidator()
    
    test_words = ["hello", "cat", "dog", "the", "xyz123", "asdfgh"]
    
    print("Testing individual words:")
    for word in test_words:
        is_valid = validator.is_valid_word(word)
        status = "✓ Valid" if is_valid else "✗ Invalid"
        print(f"  {word}: {status}")
    
    print("\nTesting batch validation:")
    result = validator.validate_words(test_words)
    print(f"  Total: {result['total']}")
    print(f"  Valid: {result['valid_count']} - {result['valid']}")
    print(f"  Invalid: {result['invalid_count']} - {result['invalid']}")
