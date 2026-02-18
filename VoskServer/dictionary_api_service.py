"""
Simple Dictionary API Service
Fetches word definitions and pronunciations from dictionaryapi.dev
Clean and straightforward implementation
"""

import requests
import json
from typing import Optional, Dict, List

class DictionaryAPIService:
    """Simple service to fetch word data from Dictionary API"""
    
    def __init__(self):
        self.base_url = "https://api.dictionaryapi.dev/api/v2/entries/en"
        self.cache = {}  # Simple in-memory cache
    
    def get_word_data(self, word: str) -> Optional[Dict]:
        """
        Fetch word data from Dictionary API
        
        Args:
            word: The word to look up
            
        Returns:
            Dictionary with word data or None if not found
        """
        # Check cache first
        word_lower = word.lower().strip()
        if word_lower in self.cache:
            return self.cache[word_lower]
        
        try:
            # Make API request
            url = f"{self.base_url}/{word_lower}"
            response = requests.get(url, timeout=2)
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract useful information
                word_info = self._extract_word_info(data)
                
                # Cache the result
                self.cache[word_lower] = word_info
                
                return word_info
            else:
                # Word not found
                self.cache[word_lower] = None
                return None
                
        except Exception as e:
            print(f"Dictionary API error for '{word}': {e}")
            return None
    
    def _extract_word_info(self, api_data: List[Dict]) -> Dict:
        """
        Extract useful information from API response
        
        Args:
            api_data: Raw API response
            
        Returns:
            Simplified word information
        """
        if not api_data or len(api_data) == 0:
            return None
        
        first_entry = api_data[0]
        
        # Extract phonetics
        phonetics = []
        if 'phonetics' in first_entry:
            for phonetic in first_entry['phonetics']:
                if 'text' in phonetic:
                    phonetics.append(phonetic['text'])
        
        # Extract meanings
        meanings = []
        if 'meanings' in first_entry:
            for meaning in first_entry['meanings']:
                part_of_speech = meaning.get('partOfSpeech', '')
                definitions = []
                
                if 'definitions' in meaning:
                    for definition in meaning['definitions'][:2]:  # Only first 2 definitions
                        definitions.append(definition.get('definition', ''))
                
                if definitions:
                    meanings.append({
                        'partOfSpeech': part_of_speech,
                        'definitions': definitions
                    })
        
        return {
            'word': first_entry.get('word', ''),
            'phonetics': phonetics,
            'meanings': meanings
        }
    
    def check_word_exists(self, word: str) -> bool:
        """
        Check if a word exists in the dictionary
        
        Args:
            word: The word to check
            
        Returns:
            True if word exists, False otherwise
        """
        word_data = self.get_word_data(word)
        return word_data is not None
    
    def get_phonetics(self, word: str) -> List[str]:
        """
        Get phonetic pronunciations for a word
        
        Args:
            word: The word to get phonetics for
            
        Returns:
            List of phonetic pronunciations
        """
        word_data = self.get_word_data(word)
        if word_data:
            return word_data.get('phonetics', [])
        return []
    
    def clear_cache(self):
        """Clear the cache"""
        self.cache.clear()


# Global instance
_dictionary_service = None

def get_dictionary_service() -> DictionaryAPIService:
    """Get or create the global dictionary service instance"""
    global _dictionary_service
    if _dictionary_service is None:
        _dictionary_service = DictionaryAPIService()
    return _dictionary_service


# Simple helper functions
def word_exists(word: str) -> bool:
    """Check if a word exists in the dictionary"""
    service = get_dictionary_service()
    return service.check_word_exists(word)


def get_word_phonetics(word: str) -> List[str]:
    """Get phonetic pronunciations for a word"""
    service = get_dictionary_service()
    return service.get_phonetics(word)


def get_word_info(word: str) -> Optional[Dict]:
    """Get full word information"""
    service = get_dictionary_service()
    return service.get_word_data(word)


# Test function
if __name__ == "__main__":
    # Test the service
    service = DictionaryAPIService()
    
    test_words = ["hello", "cat", "dog", "the", "xyz123"]
    
    for word in test_words:
        print(f"\nTesting word: {word}")
        word_data = service.get_word_data(word)
        
        if word_data:
            print(f"  ✓ Found in dictionary")
            print(f"  Phonetics: {word_data.get('phonetics', [])}")
            print(f"  Meanings: {len(word_data.get('meanings', []))} found")
        else:
            print(f"  ✗ Not found in dictionary")
