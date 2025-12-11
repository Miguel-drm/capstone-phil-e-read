#!/usr/bin/env python3
"""
English Pronunciation Dictionary for Children's Speech Recognition
===================================================================

Comprehensive dictionary of English words with common pronunciation variants
for children learning to read. Handles:
- Child mispronunciations
- Common speech patterns
- Phonetic variations
- Regional accents

Usage:
    from english_pronunciation_dictionary import match_word, PRONUNCIATION_DICT
    
    canonical = match_word('da')  # Returns 'the'
    variants = PRONUNCIATION_DICT.get('dog', [])
"""

import re
from typing import List, Optional, Dict
from difflib import get_close_matches

# ============================================================================
# PRONUNCIATION DICTIONARY
# ============================================================================

# Category: Common Articles and Determiners
ARTICLES = {
    'the': ['the', 'da', 'de', 'thee', 'thuh'],
    'a': ['a', 'uh', 'ay', 'ah', 'ey', 'eh', 'ae'],
    'an': ['an', 'un'],
    'this': ['this', 'dis', 'thiss'],
    'that': ['that', 'dat', 'thatt'],
    'these': ['these', 'deez', 'theez'],
    'those': ['those', 'doze', 'thoze'],
    'my': ['my', 'mai', 'mah'],
    'your': ['your', 'yor', 'yur'],
    'his': ['his', 'hiz', 'hiss'],
    'her': ['her', 'hur', 'herr'],
    'its': ['its', 'itz'],
    'our': ['our', 'are', 'ow-er'],
    'their': ['their', 'there', 'thair', 'der'],
}

# Category: Common Pronouns
PRONOUNS = {
    'i': ['i', 'ai', 'eye'],
    'you': ['you', 'yu', 'yoo'],
    'he': ['he', 'hee'],
    'she': ['she', 'shee'],
    'it': ['it', 'itt'],
    'we': ['we', 'wee'],
    'they': ['they', 'thay', 'dey'],
    'me': ['me', 'mee'],
    'him': ['him', 'hymn'],
    'them': ['them', 'dem', 'thum'],
    'us': ['us', 'uss'],
}


# Category: Common Verbs - Present Tense
VERBS_PRESENT = {
    'is': ['is', 'iz', 'iss'],
    'are': ['are', 'ar', 'arr'],
    'am': ['am', 'um'],
    'was': ['was', 'wuz', 'woz'],
    'were': ['were', 'wer', 'wurr'],
    'have': ['have', 'hav', 'haff'],
    'has': ['has', 'haz', 'hass'],
    'had': ['had', 'hadd'],
    'do': ['do', 'doo'],
    'does': ['does', 'duz', 'doze'],
    'did': ['did', 'didd'],
    'go': ['go', 'goh'],
    'goes': ['goes', 'goze', 'goz'],
    'went': ['went', 'wint'],
    'come': ['come', 'cum', 'kum'],
    'came': ['came', 'kaym'],
    'see': ['see', 'sea', 'si'],
    'saw': ['saw', 'sah', 'sore'],
    'look': ['look', 'luk', 'lookk'],
    'run': ['run', 'runn'],
    'walk': ['walk', 'wok', 'wawk'],
    'eat': ['eat', 'eet', 'ate'],
    'drink': ['drink', 'dink', 'drinkk'],
    'sleep': ['sleep', 'sleap', 'slep'],
    'play': ['play', 'plai', 'pley'],
    'read': ['read', 'reed', 'red'],
    'write': ['write', 'rite', 'writ'],
    'say': ['say', 'sey', 'sai'],
    'tell': ['tell', 'tel'],
    'give': ['give', 'giv', 'giff'],
    'take': ['take', 'tayk', 'tak'],
    'make': ['make', 'mayk', 'mak'],
    'get': ['get', 'git', 'gett'],
    'put': ['put', 'putt'],
    'sit': ['sit', 'sitt'],
    'stand': ['stand', 'stann'],
    'jump': ['jump', 'jum', 'jumpp'],
    'fly': ['fly', 'flai', 'fli'],
    'swim': ['swim', 'swimm'],
    'sing': ['sing', 'singg'],
    'dance': ['dance', 'dans', 'danse'],
    'help': ['help', 'hellp'],
    'work': ['work', 'wurk', 'werk'],
    'stop': ['stop', 'stopp'],
    'start': ['start', 'starrt'],
    'open': ['open', 'opin', 'opun'],
    'close': ['close', 'cloze', 'cloz'],
    'like': ['like', 'lik', 'lyke'],
    'love': ['love', 'luv', 'luff'],
    'want': ['want', 'wont', 'wannt'],
    'need': ['need', 'nead', 'needd'],
    'know': ['know', 'no', 'noh'],
    'think': ['think', 'tink', 'thinkk'],
}


# Category: Common Nouns - Animals
ANIMALS = {
    'dog': ['dog', 'dawg', 'dogg'],
    'cat': ['cat', 'cut' 'kat', 'catt'],
    'bird': ['bird', 'burd', 'birrd'],
    'fish': ['fish', 'fiss', 'phish'],
    'cow': ['cow', 'kow', 'caw'],
    'pig': ['pig', 'pigg'],
    'horse': ['horse', 'hors', 'horss'],
    'sheep': ['sheep', 'shep', 'sheap'],
    'goat': ['goat', 'gote', 'goht'],
    'chicken': ['chicken', 'chiken', 'chickin'],
    'duck': ['duck', 'duk', 'dukk'],
    'rabbit': ['rabbit', 'rabit', 'rabbitt'],
    'mouse': ['mouse', 'mous', 'mowse'],
    'rat': ['rat', 'ratt'],
    'lion': ['lion', 'lyon', 'lyin'],
    'tiger': ['tiger', 'tyger', 'tigger'],
    'bear': ['bear', 'bare', 'bair'],
    'elephant': ['elephant', 'elefant', 'ellephant'],
    'monkey': ['monkey', 'munkey', 'monkee'],
    'snake': ['snake', 'snayk', 'snak'],
    'frog': ['frog', 'frawg', 'frogg'],
    'turtle': ['turtle', 'turdle', 'turtul'],
    'butterfly': ['butterfly', 'butterflai', 'buterfly'],
    'bee': ['bee', 'be', 'bea'],
    'ant': ['ant', 'antt'],
    'spider': ['spider', 'spyder', 'spida'],
}

# Category: Common Nouns - Body Parts
BODY_PARTS = {
    'head': ['head', 'hed', 'hedd'],
    'face': ['face', 'fays', 'fase'],
    'eye': ['eye', 'i', 'ai'],
    'ear': ['ear', 'eer', 'ere'],
    'nose': ['nose', 'noze', 'noz'],
    'mouth': ['mouth', 'mowth', 'mout'],
    'tooth': ['tooth', 'toof', 'tuth'],
    'teeth': ['teeth', 'teef', 'teath'],
    'tongue': ['tongue', 'tung', 'tong'],
    'neck': ['neck', 'nek', 'nekk'],
    'shoulder': ['shoulder', 'sholder', 'sholda'],
    'arm': ['arm', 'arrm'],
    'hand': ['hand', 'hann'],
    'finger': ['finger', 'finga', 'fingger'],
    'thumb': ['thumb', 'thum', 'tumb'],
    'leg': ['leg', 'legg'],
    'knee': ['knee', 'nee', 'ni'],
    'foot': ['foot', 'fut', 'foott'],
    'feet': ['feet', 'feat', 'fete'],
    'toe': ['toe', 'tow', 'toh'],
    'back': ['back', 'bak', 'bakk'],
    'chest': ['chest', 'chist', 'chesst'],
    'stomach': ['stomach', 'stumak', 'stomak'],
    'heart': ['heart', 'hart', 'hearrt'],
    'skin': ['skin', 'skinn'],
    'hair': ['hair', 'hare', 'hayr'],
}


# Category: Common Nouns - Food and Drinks
FOOD_DRINKS = {
    'food': ['food', 'fud', 'fuud'],
    'water': ['water', 'wata', 'watter'],
    'milk': ['milk', 'melk', 'milkk'],
    'juice': ['juice', 'joos', 'juce'],
    'bread': ['bread', 'bred', 'bredd'],
    'rice': ['rice', 'rys', 'ryce'],
    'meat': ['meat', 'meet', 'mete'],
    'chicken': ['chicken', 'chiken', 'chickin'],
    'fish': ['fish', 'fiss', 'phish'],
    'egg': ['egg', 'eg', 'eggz'],
    'cheese': ['cheese', 'cheez', 'chees'],
    'butter': ['butter', 'butta', 'buttur'],
    'apple': ['apple', 'apel', 'appul'],
    'banana': ['banana', 'bananna', 'banan'],
    'orange': ['orange', 'oranj', 'orang'],
    'grape': ['grape', 'grayp', 'grap'],
    'strawberry': ['strawberry', 'strawbery', 'strawberri'],
    'carrot': ['carrot', 'karot', 'carott'],
    'potato': ['potato', 'potayto', 'potaito'],
    'tomato': ['tomato', 'tomayto', 'tomaito'],
    'cake': ['cake', 'kayk', 'cak'],
    'cookie': ['cookie', 'cooky', 'cuki'],
    'candy': ['candy', 'kandi', 'candee'],
    'ice cream': ['ice cream', 'icecream', 'iscream'],
    'pizza': ['pizza', 'pitza', 'piza'],
    'sandwich': ['sandwich', 'sandwitch', 'sanwich'],
    'soup': ['soup', 'soop', 'sup'],
    'salad': ['salad', 'sallad', 'salid'],
    'tea': ['tea', 'tee', 'ti'],
    'coffee': ['coffee', 'coffy', 'cofee'],
}

# Category: Common Nouns - Colors
COLORS = {
    'red': ['red', 'redd'],
    'blue': ['blue', 'bloo', 'blu'],
    'green': ['green', 'grean', 'gren'],
    'yellow': ['yellow', 'yello', 'yelow'],
    'orange': ['orange', 'oranj', 'orang'],
    'purple': ['purple', 'purpul', 'perpul'],
    'pink': ['pink', 'pinkk'],
    'brown': ['brown', 'broun', 'brownn'],
    'black': ['black', 'blak', 'blakk'],
    'white': ['white', 'wite', 'whyt'],
    'gray': ['gray', 'grey', 'gra'],
    'gold': ['gold', 'gol', 'goldd'],
    'silver': ['silver', 'silvar', 'silvur'],
}

# Category: Common Nouns - Numbers
NUMBERS = {
    'one': ['one', 'won', 'wun'],
    'two': ['two', 'too', 'tu'],
    'three': ['three', 'tree', 'thre'],
    'four': ['four', 'for', 'fore'],
    'five': ['five', 'fiv', 'fyve'],
    'six': ['six', 'siks', 'sikks'],
    'seven': ['seven', 'sevin', 'sevun'],
    'eight': ['eight', 'ate', 'ait'],
    'nine': ['nine', 'nyn', 'nien'],
    'ten': ['ten', 'tenn'],
    'eleven': ['eleven', 'elevin', 'elevun'],
    'twelve': ['twelve', 'twelv', 'twelff'],
    'thirteen': ['thirteen', 'therteen', 'thirten'],
    'fourteen': ['fourteen', 'forteen', 'fourten'],
    'fifteen': ['fifteen', 'fiften', 'fivteen'],
    'sixteen': ['sixteen', 'sikteen', 'sixten'],
    'seventeen': ['seventeen', 'seventen', 'seventean'],
    'eighteen': ['eighteen', 'eiteen', 'eightean'],
    'nineteen': ['nineteen', 'ninteen', 'nynteen'],
    'twenty': ['twenty', 'twenny', 'twentee'],
    'thirty': ['thirty', 'therty', 'thirtee'],
    'forty': ['forty', 'fortee', 'fourty'],
    'fifty': ['fifty', 'fiftee', 'fivty'],
    'hundred': ['hundred', 'hunderd', 'hundrid'],
    'thousand': ['thousand', 'thowsand', 'thousan'],
}


# Category: Common Adjectives
ADJECTIVES = {
    'big': ['big', 'bigg'],
    'small': ['small', 'smol', 'smal'],
    'tall': ['tall', 'tal', 'tawl'],
    'short': ['short', 'shurt', 'shorrt'],
    'long': ['long', 'lawng', 'longg'],
    'fat': ['fat', 'fatt'],
    'thin': ['thin', 'thinn'],
    'hot': ['hot', 'hott'],
    'cold': ['cold', 'kold', 'coldd'],
    'warm': ['warm', 'worm', 'warrm'],
    'cool': ['cool', 'kool', 'cul'],
    'good': ['good', 'gud', 'guud'],
    'bad': ['bad', 'badd'],
    'happy': ['happy', 'hapi', 'happee'],
    'sad': ['sad', 'sadd'],
    'angry': ['angry', 'angree', 'angri'],
    'scared': ['scared', 'skared', 'scaired'],
    'brave': ['brave', 'brayv', 'brav'],
    'strong': ['strong', 'strawng', 'stron'],
    'weak': ['weak', 'week', 'wek'],
    'fast': ['fast', 'fasst', 'fahst'],
    'slow': ['slow', 'sloh', 'slowe'],
    'loud': ['loud', 'lowd', 'lowdd'],
    'quiet': ['quiet', 'kwiet', 'quyet'],
    'clean': ['clean', 'kleen', 'cleen'],
    'dirty': ['dirty', 'derty', 'dirtee'],
    'new': ['new', 'nu', 'noo'],
    'old': ['old', 'oldd'],
    'young': ['young', 'yung', 'youngg'],
    'pretty': ['pretty', 'pritty', 'prety'],
    'ugly': ['ugly', 'uglee', 'ugli'],
    'nice': ['nice', 'nys', 'nyce'],
    'mean': ['mean', 'meen', 'mene'],
    'kind': ['kind', 'kynd', 'kindd'],
    'smart': ['smart', 'smarrt', 'smaart'],
    'silly': ['silly', 'sily', 'sillee'],
    'funny': ['funny', 'funee', 'funi'],
    'easy': ['easy', 'eazy', 'eesy'],
    'hard': ['hard', 'harrd', 'hardd'],
    'soft': ['soft', 'sawft', 'sofft'],
    'rough': ['rough', 'ruff', 'ruf'],
    'smooth': ['smooth', 'smuth', 'smoothe'],
    'wet': ['wet', 'wett'],
    'dry': ['dry', 'dri', 'drye'],
    'full': ['full', 'ful', 'foll'],
    'empty': ['empty', 'emptee', 'empti'],
    'heavy': ['heavy', 'hevvy', 'hevi'],
    'light': ['light', 'lite', 'lyt'],
}


# Category: Common Nouns - Places and Objects
PLACES_OBJECTS = {
    'house': ['house', 'hows', 'howse'],
    'home': ['home', 'hohm', 'hoam'],
    'school': ['school', 'skool', 'scool'],
    'room': ['room', 'rum', 'rooom'],
    'door': ['door', 'dor', 'doore'],
    'window': ['window', 'windo', 'windoh'],
    'wall': ['wall', 'wol', 'wawl'],
    'floor': ['floor', 'flor', 'floore'],
    'ceiling': ['ceiling', 'seeling', 'ceeling'],
    'table': ['table', 'tayble', 'tabel'],
    'chair': ['chair', 'chare', 'chayr'],
    'bed': ['bed', 'bedd'],
    'desk': ['desk', 'deskk'],
    'book': ['book', 'buk', 'bookk'],
    'pen': ['pen', 'penn'],
    'pencil': ['pencil', 'pensil', 'pencill'],
    'paper': ['paper', 'payper', 'papur'],
    'bag': ['bag', 'bagg'],
    'box': ['box', 'boks', 'bokks'],
    'toy': ['toy', 'toi', 'toye'],
    'ball': ['ball', 'bawl', 'bal'],
    'car': ['car', 'karr', 'carr'],
    'bus': ['bus', 'buss'],
    'train': ['train', 'trayn', 'trane'],
    'plane': ['plane', 'playn', 'plaine'],
    'boat': ['boat', 'bote', 'boht'],
    'bike': ['bike', 'byk', 'byke'],
    'tree': ['tree', 'tre', 'trea'],
    'flower': ['flower', 'flowr', 'flowur'],
    'grass': ['grass', 'gras', 'grasse'],
    'sun': ['sun', 'sunn'],
    'moon': ['moon', 'mune', 'mun'],
    'star': ['star', 'starr'],
    'sky': ['sky', 'ski', 'skye'],
    'cloud': ['cloud', 'clowd', 'clowdd'],
    'rain': ['rain', 'rayn', 'rane'],
    'snow': ['snow', 'snoh', 'snowe'],
    'wind': ['wind', 'winn', 'wynde'],
}

# Category: Common Prepositions
PREPOSITIONS = {
    'in': ['in', 'inn'],
    'on': ['on', 'onn'],
    'at': ['at', 'att'],
    'to': ['to', 'too', 'tu'],
    'from': ['from', 'frum', 'fromm'],
    'with': ['with', 'wif', 'wiff'],
    'by': ['by', 'bi', 'bye'],
    'for': ['for', 'four', 'fore'],
    'of': ['of', 'ov', 'off'],
    'up': ['up', 'upp'],
    'down': ['down', 'doun', 'downn'],
    'over': ['over', 'ovar', 'ovur'],
    'under': ['under', 'undar', 'undur'],
    'above': ['above', 'abuv', 'abov'],
    'below': ['below', 'belo', 'beloh'],
    'between': ['between', 'betwean', 'betwen'],
    'behind': ['behind', 'behynd', 'behinde'],
    'in front of': ['in front of', 'infront', 'infrontof'],
    'next to': ['next to', 'nextto', 'nekst to'],
    'near': ['near', 'neer', 'nere'],
    'far': ['far', 'farr'],
    'inside': ['inside', 'insyd', 'insyde'],
    'outside': ['outside', 'owtsyde', 'outsyd'],
    'through': ['through', 'thru', 'threw'],
    'across': ['across', 'akross', 'acros'],
    'around': ['around', 'aroun', 'arownd'],
}


# Category: Common Conjunctions and Connectors
CONJUNCTIONS = {
    'and': ['and', 'an', 'annd'],
    'or': ['or', 'orr'],
    'but': ['but', 'butt'],
    'so': ['so', 'soh', 'sew'],
    'because': ['because', 'becuz', 'becaus'],
    'if': ['if', 'iff'],
    'when': ['when', 'wen', 'whenn'],
    'then': ['then', 'den', 'thenn'],
    'than': ['than', 'then', 'thann'],
    'while': ['while', 'wile', 'whyle'],
    'until': ['until', 'untill', 'untul'],
    'before': ['before', 'befor', 'befour'],
    'after': ['after', 'aftur', 'affter'],
    'since': ['since', 'sinse', 'sins'],
    'although': ['although', 'altho', 'althoh'],
}

# Category: Question Words
QUESTION_WORDS = {
    'what': ['what', 'wat', 'whatt'],
    'who': ['who', 'hoo', 'whoo'],
    'where': ['where', 'were', 'whare'],
    'when': ['when', 'wen', 'whenn'],
    'why': ['why', 'wi', 'wye'],
    'how': ['how', 'hau', 'howe'],
    'which': ['which', 'wich', 'whitch'],
    'whose': ['whose', 'hooz', 'whoze'],
}

# Category: Common Adverbs
ADVERBS = {
    'very': ['very', 'verry', 'veri'],
    'too': ['too', 'to', 'tu'],
    'also': ['also', 'allso', 'awlso'],
    'always': ['always', 'allways', 'alwayz'],
    'never': ['never', 'nevur', 'nevver'],
    'sometimes': ['sometimes', 'sumtimes', 'sometymes'],
    'often': ['often', 'offen', 'offten'],
    'usually': ['usually', 'usally', 'usualy'],
    'now': ['now', 'nau', 'nowe'],
    'then': ['then', 'den', 'thenn'],
    'here': ['here', 'heer', 'hear'],
    'there': ['there', 'thare', 'ther'],
    'everywhere': ['everywhere', 'evrywhere', 'evreewhere'],
    'nowhere': ['nowhere', 'nowere', 'nowhare'],
    'today': ['today', 'tuday', 'todai'],
    'yesterday': ['yesterday', 'yesturday', 'yesterdai'],
    'tomorrow': ['tomorrow', 'tomorro', 'tomorow'],
    'again': ['again', 'agen', 'agane'],
    'already': ['already', 'allready', 'alredy'],
    'still': ['still', 'stil', 'styll'],
    'yet': ['yet', 'yett'],
    'just': ['just', 'juss', 'jusst'],
    'only': ['only', 'onlee', 'onli'],
    'even': ['even', 'evin', 'evun'],
    'almost': ['almost', 'allmost', 'awlmost'],
    'quite': ['quite', 'kwite', 'quyte'],
    'really': ['really', 'realy', 'relly'],
    'maybe': ['maybe', 'mayb', 'maybee'],
    'perhaps': ['perhaps', 'perhap', 'perhapps'],
}

# Category: Common Interjections
INTERJECTIONS = {
    'yes': ['yes', 'yess', 'yeh'],
    'no': ['no', 'noh', 'nope'],
    'okay': ['okay', 'ok', 'okey'],
    'hello': ['hello', 'helo', 'hellow'],
    'hi': ['hi', 'hai', 'hye'],
    'bye': ['bye', 'by', 'bai'],
    'goodbye': ['goodbye', 'goodby', 'gudbye'],
    'please': ['please', 'pleez', 'pleas'],
    'thank you': ['thank you', 'thankyou', 'thanks'],
    'sorry': ['sorry', 'sory', 'sorri'],
    'excuse me': ['excuse me', 'excuseme', 'scuse me'],
    'wow': ['wow', 'wau', 'woww'],
    'oh': ['oh', 'o', 'ohh'],
    'ah': ['ah', 'ahh', 'aah'],
    'ouch': ['ouch', 'owch', 'owtch'],
    'yay': ['yay', 'yey', 'yaay'],
    'hooray': ['hooray', 'horay', 'hurray'],
}

# ============================================================================
# COMBINE ALL CATEGORIES INTO MAIN DICTIONARY
# ============================================================================

PRONUNCIATION_DICT: Dict[str, List[str]] = {}

# Merge all category dictionaries
for category_dict in [
    ARTICLES, PRONOUNS, VERBS_PRESENT, ANIMALS, BODY_PARTS,
    FOOD_DRINKS, COLORS, NUMBERS, ADJECTIVES, PLACES_OBJECTS,
    PREPOSITIONS, CONJUNCTIONS, QUESTION_WORDS, ADVERBS, INTERJECTIONS
]:
    PRONUNCIATION_DICT.update(category_dict)

# ============================================================================
# REVERSE LOOKUP: Variant -> Canonical Word
# ============================================================================

VARIANT_TO_CANONICAL: Dict[str, str] = {}

for canonical, variants in PRONUNCIATION_DICT.items():
    for variant in variants:
        VARIANT_TO_CANONICAL[variant.lower()] = canonical

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def normalize_word(word: str) -> str:
    """Normalize a word for matching."""
    return re.sub(r'[^\w]', '', word.lower()).strip()


def match_word(heard_word: str, threshold: float = 0.8) -> Optional[str]:
    """
    Match a heard word to its canonical form.
    
    Args:
        heard_word: Word heard from microphone
        threshold: Similarity threshold for fuzzy matching (0.0-1.0)
        
    Returns:
        Canonical word if match found, None otherwise
    """
    normalized = normalize_word(heard_word)
    
    if not normalized:
        return None
    
    # Direct lookup
    if normalized in VARIANT_TO_CANONICAL:
        return VARIANT_TO_CANONICAL[normalized]
    
    # Fuzzy matching
    all_variants = list(VARIANT_TO_CANONICAL.keys())
    matches = get_close_matches(normalized, all_variants, n=1, cutoff=threshold)
    
    if matches:
        return VARIANT_TO_CANONICAL[matches[0]]
    
    # Check if already canonical
    if normalized in PRONUNCIATION_DICT:
        return normalized
    
    return None


def is_pronunciation_match(spoken_word: str, expected_word: str, threshold: float = 0.8) -> bool:
    """
    Check if a spoken word matches an expected word (considering pronunciation variants).
    
    Args:
        spoken_word: Word heard from microphone
        expected_word: Expected canonical word
        threshold: Similarity threshold for fuzzy matching (0.0-1.0)
        
    Returns:
        True if words match, False otherwise
    """
    spoken_normalized = normalize_word(spoken_word)
    expected_normalized = normalize_word(expected_word)
    
    if not spoken_normalized or not expected_normalized:
        return False
    
    # Exact match
    if spoken_normalized == expected_normalized:
        return True
    
    # Check if spoken word is a variant of expected word
    expected_variants = get_variants(expected_normalized)
    if spoken_normalized in [normalize_word(v) for v in expected_variants]:
        return True
    
    # Check if spoken word matches expected word via canonical lookup
    spoken_canonical = match_word(spoken_word, threshold)
    if spoken_canonical and spoken_canonical == expected_normalized:
        return True
    
    return False


def get_pronunciation_variants(word: str) -> List[str]:
    """
    Alias for get_variants() for compatibility with server code.
    """
    return get_variants(word)


def get_variants(canonical_word: str) -> List[str]:
    """
    Get all pronunciation variants for a canonical word.
    Uses auto-generation as fallback if word not in dictionary.
    
    Args:
        canonical_word: Canonical form of the word
        
    Returns:
        List of pronunciation variants
    """
    normalized = normalize_word(canonical_word)
    
    # First check if word is in dictionary
    if normalized in PRONUNCIATION_DICT:
        return PRONUNCIATION_DICT[normalized]
    
    # Fallback: Use auto-generation for unknown words
    try:
        from auto_pronunciation_generator import generate_variants
        auto_variants = generate_variants(normalized, 'english')
        print(f"🤖 Auto-generated variants for '{normalized}': {auto_variants[:5]}")
        return auto_variants
    except ImportError:
        # If auto-generator not available, return word as-is
        return [normalized]


def get_all_canonical_words() -> List[str]:
    """Get list of all canonical words in the dictionary."""
    return sorted(PRONUNCIATION_DICT.keys())


def get_dictionary_stats() -> Dict[str, int]:
    """Get statistics about the pronunciation dictionary."""
    total_canonical = len(PRONUNCIATION_DICT)
    total_variants = sum(len(variants) for variants in PRONUNCIATION_DICT.values())
    
    return {
        'total_canonical_words': total_canonical,
        'total_variants': total_variants,
        'average_variants_per_word': round(total_variants / total_canonical, 2)
    }


def search_words(pattern: str) -> List[str]:
    """Search for words matching a pattern."""
    regex = re.compile(pattern, re.IGNORECASE)
    return [word for word in PRONUNCIATION_DICT.keys() if regex.search(word)]


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """Demonstrate the English pronunciation dictionary."""
    print("=" * 70)
    print("  ENGLISH PRONUNCIATION DICTIONARY FOR CHILDREN'S SPEECH RECOGNITION")
    print("=" * 70)
    print()
    
    # Print statistics
    stats = get_dictionary_stats()
    print("📊 Dictionary Statistics:")
    print(f"   Total Canonical Words: {stats['total_canonical_words']}")
    print(f"   Total Variants: {stats['total_variants']}")
    print(f"   Average Variants per Word: {stats['average_variants_per_word']}")
    print()
    
    # Print sample entries
    print("📖 Sample Dictionary Entries:")
    print("-" * 70)
    
    sample_words = list(PRONUNCIATION_DICT.items())[:20]
    for i, (canonical, variants) in enumerate(sample_words, 1):
        variants_str = ", ".join(variants)
        print(f"{i:4d}. {canonical:20s} → [{variants_str}]")
    
    print(f"   ... and {len(PRONUNCIATION_DICT) - 20} more words")
    print("-" * 70)
    print()
    
    # Demonstrate word matching
    print("🔍 Word Matching Examples:")
    print("-" * 70)
    
    test_words = [
        'da', 'dawg', 'kat', 'bloo', 'tree', 
        'wun', 'tu', 'bigg', 'smol', 'hapi'
    ]
    
    for test_word in test_words:
        canonical = match_word(test_word)
        if canonical:
            print(f"   mic heard: '{test_word:15s}' → matched to: '{canonical}'")
        else:
            print(f"   mic heard: '{test_word:15s}' → no match found")
    
    print("-" * 70)
    print()
    print("✅ Dictionary ready for integration with speech recognition system!")
    print()


if __name__ == "__main__":
    main()
