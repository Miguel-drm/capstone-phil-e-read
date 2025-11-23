#!/usr/bin/env python3
"""
English Pronunciation Dictionary
=================================

Comprehensive dictionary of English words with common pronunciation variants.
Used by the server to match spoken words to expected words, handling:
- Child mispronunciations
- Filipino accent variations (TH sounds, etc.)
- Common speech patterns
- Single letters (A, I, etc.)

Usage:
    from english_pronunciation_dictionary import ENGLISH_PRONUNCIATION_DICT
    
    variants = ENGLISH_PRONUNCIATION_DICT.get('the', [])
    # Returns: ['da', 'de', 'duh', 'di', 'za', 'ze']
"""

# ============================================================================
# ENGLISH PRONUNCIATION DICTIONARY
# ============================================================================

ENGLISH_PRONUNCIATION_DICT: dict[str, list[str]] = {
    # Single letters - CRITICAL for recognition
    'a': ['a', 'ah', 'ay', 'eh', 'uh'],
    'i': ['i', 'e', 'ee', 'eye', 'ay'],
    'o': ['o', 'oh', 'owe', 'uh'],
    'u': ['u', 'you', 'yoo', 'oo'],
    'e': ['e', 'ee', 'eh', 'i'],
    'b': ['b', 'be', 'bee'],
    'c': ['c', 'see', 'sea'],
    'd': ['d', 'dee', 'the'],
    'f': ['f', 'ef', 'eff'],
    'g': ['g', 'gee', 'jee'],
    'h': ['h', 'aitch', 'haitch'],
    'j': ['j', 'jay', 'jey'],
    'k': ['k', 'kay', 'key'],
    'l': ['l', 'el', 'ell'],
    'm': ['m', 'em', 'emm'],
    'n': ['n', 'en', 'enn'],
    'p': ['p', 'pee', 'pi'],
    'q': ['q', 'cue', 'queue'],
    'r': ['r', 'ar', 'are'],
    's': ['s', 'es', 'ess'],
    't': ['t', 'tee', 'tea'],
    'v': ['v', 'vee', 'vi'],
    'w': ['w', 'double-u', 'double you'],
    'x': ['x', 'ex', 'eks'],
    'y': ['y', 'why', 'wye'],
    'z': ['z', 'zed', 'zee'],
    
    # Filipino accent variations - TH sounds (very common in Philippines)
    'the': ['da', 'de', 'duh', 'di', 'za', 'ze', 'the'],
    'this': ['dis', 'dees', 'tis', 'zis', 'this'],
    'that': ['dat', 'det', 'tat', 'zat', 'that'],
    'three': ['tree', 'tri', 'three'],
    'think': ['tink', 'tingk', 'think'],
    'thing': ['ting', 'thing'],
    'with': ['wit', 'wid', 'with'],
    'they': ['dey', 'day', 'they'],
    'them': ['dem', 'them'],
    'there': ['der', 'dere', 'there'],
    'their': ['der', 'deir', 'their'],
    'then': ['den', 'then'],
    'than': ['dan', 'than'],
    'through': ['tru', 'troo', 'through'],
    'thought': ['tot', 'taught', 'thought'],
    'though': ['do', 'dough', 'though'],
    'these': ['dis', 'dees', 'these'],
    'those': ['dos', 'dose', 'those'],
    'other': ['oder', 'udder', 'other'],
    'another': ['anoder', 'anudder', 'another'],
    'brother': ['broder', 'brudder', 'brother'],
    'mother': ['moder', 'mudder', 'mother'],
    'father': ['fader', 'fadder', 'father'],
    'weather': ['weder', 'wedder', 'weather'],
    'whether': ['weder', 'wedder', 'whether'],
    'together': ['togeder', 'togedder', 'together'],
    'nothing': ['noting', 'nutting', 'nothing'],
    'something': ['someting', 'sumting', 'something'],
    'anything': ['anyting', 'eniting', 'anything'],
    'everything': ['everyting', 'evriting', 'everything'],
    'birthday': ['birtday', 'burtday', 'birthday'],
    'bathroom': ['batroom', 'batrum', 'bathroom'],
    'math': ['mat', 'mats', 'math'],
    'path': ['pat', 'pats', 'path'],
    'both': ['bot', 'bots', 'both'],
    'mouth': ['mout', 'mowt', 'mouth'],
    'south': ['sout', 'sowt', 'south'],
    'north': ['nort', 'norts', 'north'],
    
    # Common sight words and function words
    'about': ['abowt', 'bout', 'about'],
    'after': ['after', 'apter', 'after'],
    'again': ['agen', 'agin', 'again'],
    'always': ['allways', 'alwys', 'always'],
    'around': ['aroun', 'round', 'around'],
    'because': ['becuz', 'cuz', 'coz', 'because'],
    'before': ['befor', 'bfor', 'before'],
    'between': ['betwee', 'btween', 'between'],
    'could': ['cud', 'kud', 'could'],
    'should': ['shud', 'shoud', 'should'],
    'would': ['wud', 'wood', 'would'],
    'does': ['dus', 'duz', 'does'],
    'done': ['dun', 'don', 'done'],
    'every': ['evry', 'everi', 'every'],
    'first': ['furst', 'firs', 'first'],
    'friend': ['frend', 'fren', 'friend'],
    'from': ['frum', 'form', 'from'],
    'have': ['hav', 'hab', 'have'],
    'here': ['hir', 'hear', 'here'],
    'into': ['intu', 'ento', 'into'],
    'just': ['jus', 'jast', 'just'],
    'know': ['no', 'now', 'know'],
    'like': ['lik', 'lyke', 'like'],
    'little': ['litle', 'litl', 'little'],
    'long': ['lang', 'lon', 'long'],
    'many': ['meny', 'mani', 'many'],
    'more': ['mor', 'moar', 'more'],
    'most': ['mos', 'moast', 'most'],
    'much': ['mach', 'mutch', 'much'],
    'never': ['neber', 'nevr', 'never'],
    'only': ['onli', 'ownly', 'only'],
    'over': ['ober', 'ovr', 'over'],
    'people': ['pipol', 'peepol', 'peeple', 'people'],
    'please': ['pls', 'pleas', 'plz', 'please'],
    'pretty': ['prety', 'pritty', 'pretty'],
    'really': ['realy', 'relly', 'rily', 'really'],
    'right': ['rite', 'ryt', 'right'],
    'some': ['sum', 'som', 'some'],
    'time': ['tym', 'tyme', 'time'],
    'today': ['tuday', 'todey', 'today'],
    'very': ['bery', 'veri', 'very'],
    'want': ['wanna', 'wan', 'want'],
    'water': ['wader', 'watur', 'water'],
    'were': ['wer', 'where', 'were'],
    'what': ['wat', 'wut', 'what'],
    'when': ['wen', 'win', 'when'],
    'where': ['wer', 'were', 'where'],
    'which': ['wich', 'witch', 'which'],
    'who': ['hoo', 'hu', 'who'],
    'why': ['y', 'wi', 'why'],
    'will': ['wil', 'wel', 'will'],
    'your': ['yur', 'yor', 'ur', 'your'],
    
    # Children's speech: past tense -ed endings (often dropped or mispronounced)
    'looked': ['look', 'looke', 'lookt', 'looked'],
    'walked': ['walk', 'walke', 'walkt', 'walked'],
    'talked': ['talk', 'talke', 'talkt', 'talked'],
    'picked': ['pick', 'picke', 'pickt', 'picked'],
    'noticed': ['notice', 'notic', 'notis', 'noticed'],
    'wanted': ['want', 'wante', 'wantid', 'wanted'],
    'needed': ['need', 'neede', 'needid', 'needed'],
    'started': ['start', 'starte', 'startid', 'started'],
    'ended': ['end', 'ende', 'endid', 'ended'],
    'asked': ['ask', 'aske', 'askt', 'asked'],
    'helped': ['help', 'helpe', 'helpt', 'helped'],
    'jumped': ['jump', 'jumpe', 'jumpt', 'jumped'],
    'played': ['play', 'playe', 'playd', 'played'],
    'stayed': ['stay', 'staye', 'stayd', 'stayed'],
    'tried': ['try', 'trie', 'tryd', 'tried'],
    'turned': ['turn', 'turne', 'turnd', 'turned'],
    'learned': ['learn', 'learne', 'learnd', 'learned'],
    'opened': ['open', 'opene', 'opend', 'opened'],
    'closed': ['close', 'clos', 'closd', 'closed'],
    'lived': ['live', 'liv', 'livd', 'lived'],
    'loved': ['love', 'lov', 'lovd', 'loved'],
    'moved': ['move', 'mov', 'movd', 'moved'],
    'used': ['use', 'us', 'usd', 'used'],
    'called': ['call', 'calle', 'calld', 'called'],
    'worked': ['work', 'worke', 'workt', 'worked'],
    'seemed': ['seem', 'seeme', 'seemd', 'seemed'],
    'showed': ['show', 'showe', 'showd', 'showed'],
    'followed': ['follow', 'followe', 'followd', 'followed'],
    'happened': ['happen', 'happene', 'happend', 'happened'],
    'appeared': ['appear', 'appeare', 'appeard', 'appeared'],
    'believed': ['believe', 'believ', 'believd', 'believed'],
    'received': ['receive', 'receiv', 'receivd', 'received'],
    'watched': ['watch', 'watche', 'watcht', 'watched'],
    'listened': ['listen', 'listene', 'listend', 'listened'],
    'laughed': ['laugh', 'laughe', 'laught', 'laughed'],
    'smiled': ['smile', 'smil', 'smild', 'smiled'],
    'cried': ['cry', 'crie', 'cryd', 'cried'],
    'stopped': ['stop', 'stoppe', 'stopt', 'stopped'],
    'dropped': ['drop', 'droppe', 'dropt', 'dropped'],
    'hopped': ['hop', 'hoppe', 'hopt', 'hopped'],
    'skipped': ['skip', 'skippe', 'skipt', 'skipped'],
    'clapped': ['clap', 'clappe', 'clapt', 'clapped'],
    'grabbed': ['grab', 'grabbe', 'grabt', 'grabbed'],
    'hugged': ['hug', 'hugge', 'hugt', 'hugged'],
    'kissed': ['kiss', 'kisse', 'kist', 'kissed'],
    'missed': ['miss', 'misse', 'mist', 'missed'],
    'passed': ['pass', 'passe', 'past', 'passed'],
    'pushed': ['push', 'pushe', 'pusht', 'pushed'],
    'pulled': ['pull', 'pulle', 'pulld', 'pulled'],
    'reached': ['reach', 'reache', 'reacht', 'reached'],
    'touched': ['touch', 'touche', 'toucht', 'touched'],
    'washed': ['wash', 'washe', 'washt', 'washed'],
    'wished': ['wish', 'wishe', 'wisht', 'wished'],
    'yelled': ['yell', 'yelle', 'yelld', 'yelled'],
    'answered': ['answer', 'answere', 'answerd', 'answered'],
    'climbed': ['climb', 'climbe', 'climbd', 'climbed'],
    'cooked': ['cook', 'cooke', 'cookt', 'cooked'],
    'danced': ['dance', 'danc', 'danst', 'danced'],
    'finished': ['finish', 'finishe', 'finisht', 'finished'],
    'painted': ['paint', 'painte', 'paintid', 'painted'],
    'planted': ['plant', 'plante', 'plantid', 'planted'],
    'pointed': ['point', 'pointe', 'pointid', 'pointed'],
    'remembered': ['remember', 'remembere', 'rememberd', 'remembered'],
    'visited': ['visit', 'visite', 'visitid', 'visited'],
    'waited': ['wait', 'waite', 'waitid', 'waited'],
    'wondered': ['wonder', 'wondere', 'wonderd', 'wondered'],
    
    # Common irregular verbs children struggle with
    'saw': ['see', 'sow', 'so', 'saw'],
    'said': ['say', 'sed', 'sayed', 'said'],
    'went': ['go', 'goed', 'wented', 'went'],
    'came': ['come', 'comed', 'camed', 'came'],
    'took': ['take', 'taked', 'tooked', 'took'],
    'gave': ['give', 'gived', 'gaved', 'gave'],
    'made': ['make', 'maked', 'maded', 'made'],
    'got': ['get', 'getted', 'goted', 'got'],
    'found': ['find', 'finded', 'founded', 'found'],
    'told': ['tell', 'telled', 'tolded', 'told'],
    'knew': ['know', 'knowed', 'knewed', 'knew'],
    'felt': ['feel', 'feeled', 'felted', 'felt'],
    'left': ['leave', 'leaved', 'lefted', 'left'],
    'kept': ['keep', 'keeped', 'kepted', 'kept'],
    'held': ['hold', 'holded', 'helded', 'held'],
    'brought': ['bring', 'bringed', 'broughted', 'brought'],
    'began': ['begin', 'begined', 'beganed', 'began'],
    'ran': ['run', 'runned', 'raned', 'ran'],
    'stood': ['stand', 'standed', 'stooded', 'stood'],
    'heard': ['hear', 'heared', 'herd', 'heard'],
    'became': ['become', 'becomed', 'becamed', 'became'],
    'put': ['put', 'putted', 'puted'],
    'let': ['let', 'letted', 'leted'],
    'read': ['read', 'readed', 'red'],
    'met': ['meet', 'meeted', 'meted', 'met'],
    'sat': ['sit', 'sitted', 'sated', 'sat'],
    'spoke': ['speak', 'speaked', 'spoked', 'spoke'],
    'wrote': ['write', 'writed', 'wroted', 'wrote'],
    'ate': ['eat', 'eated', 'ated', 'ate'],
    'drank': ['drink', 'drinked', 'dranked', 'drank'],
    'sang': ['sing', 'singed', 'sanged', 'sang'],
    'swam': ['swim', 'swimmed', 'swamed', 'swam'],
    'flew': ['fly', 'flyed', 'flewed', 'flew'],
    'drew': ['draw', 'drawed', 'drewed', 'drew'],
    'grew': ['grow', 'growed', 'grewed', 'grew'],
    'threw': ['throw', 'throwed', 'threwed', 'threw'],
    'wore': ['wear', 'weared', 'wored', 'wore'],
    'broke': ['break', 'breaked', 'broked', 'broke'],
    'chose': ['choose', 'choosed', 'chosed', 'chose'],
    'drove': ['drive', 'drived', 'droved', 'drove'],
    'rode': ['ride', 'rided', 'roded', 'rode'],
    'woke': ['wake', 'waked', 'woked', 'woke'],
    'froze': ['freeze', 'freezed', 'frosed', 'froze'],
    'stole': ['steal', 'stealed', 'stoled', 'stole'],
    'built': ['build', 'builded', 'bilt', 'built'],
    'bought': ['buy', 'buyed', 'boughted', 'bought'],
    'caught': ['catch', 'catched', 'caughted', 'caught'],
    'cut': ['cut', 'cutted', 'cuted'],
    'did': ['do', 'doed', 'dided', 'did'],
    'fell': ['fall', 'falled', 'felled', 'fell'],
    'fought': ['fight', 'fighted', 'foughted', 'fought'],
    'forgot': ['forget', 'forgeted', 'forgotted', 'forgot'],
    'hid': ['hide', 'hided', 'hidded', 'hid'],
    'hit': ['hit', 'hitted', 'hited'],
    'hurt': ['hurt', 'hurted', 'herted'],
    'lay': ['lie', 'lied', 'layed', 'lay'],
    'led': ['lead', 'leaded', 'ledded', 'led'],
    'lost': ['lose', 'losed', 'losted', 'lost'],
    'paid': ['pay', 'payed', 'paided', 'paid'],
    'rang': ['ring', 'ringed', 'rung', 'rang'],
    'rose': ['rise', 'rised', 'rosed', 'rose'],
    'sent': ['send', 'sended', 'sented', 'sent'],
    'shook': ['shake', 'shaked', 'shooked', 'shook'],
    'shot': ['shoot', 'shooted', 'shoted', 'shot'],
    'shut': ['shut', 'shutted', 'shuted'],
    'slept': ['sleep', 'sleeped', 'slepted', 'slept'],
    'spent': ['spend', 'spended', 'spented', 'spent'],
    'taught': ['teach', 'teached', 'taughted', 'taught'],
    'understood': ['understand', 'understanded', 'understooded', 'understood'],
    'won': ['win', 'winned', 'woned', 'won'],
    
    # Common nouns and story words
    'animal': ['animel', 'anmal', 'animal'],
    'bedroom': ['bedrum', 'bed room', 'bedroom'],
    'breakfast': ['brekfast', 'brekfest', 'breakfast'],
    'children': ['chilren', 'childs', 'children'],
    'chocolate': ['choklate', 'choclate', 'choco', 'chocolate'],
    'christmas': ['krismas', 'xmas', 'christmas'],
    'different': ['diferent', 'diffrent', 'different'],
    'finally': ['finaly', 'finely', 'finally'],
    'garden': ['gardin', 'garding', 'garden'],
    'happy': ['hapi', 'hapy', 'happy'],
    'important': ['importan', 'importent', 'important'],
    'kitchen': ['kitchin', 'kichen', 'kitchen'],
    'library': ['libary', 'liberry', 'library'],
    'morning': ['mornin', 'morming', 'morning'],
    'mountain': ['mountin', 'mowntain', 'mountain'],
    'neighbor': ['nabor', 'naybor', 'neybor', 'neighbor'],
    'picture': ['pikture', 'pitcher', 'pictur', 'picture'],
    'probably': ['probly', 'prolly', 'probably'],
    'remember': ['rember', 'remembr', 'remember'],
    'restaurant': ['restarant', 'resturant', 'restaurant'],
    'school': ['skool', 'scool', 'school'],
    'special': ['speshal', 'speshul', 'special'],
    'surprise': ['suprise', 'surprize', 'surprise'],
    'tomorrow': ['tomoro', 'tommorow', 'tomorow', 'tomorrow'],
    'tonight': ['tonite', 'to night', 'tonight'],
    'vegetable': ['vegtable', 'vegitable', 'vegetable'],
    'yesterday': ['yesturday', 'yesterdey', 'yesterday'],
    
    # Adjectives and descriptive words
    'angry': ['angri', 'angery', 'angry'],
    'busy': ['bisy', 'bizzy', 'busy'],
    'careful': ['carful', 'carefull', 'careful'],
    'comfortable': ['comftable', 'comfterble', 'comfortable'],
    'dangerous': ['dangeros', 'dangerus', 'dangerous'],
    'delicious': ['delishus', 'delisious', 'delicious'],
    'difficult': ['dificult', 'difficalt', 'difficult'],
    'excited': ['exited', 'exsited', 'excited'],
    'expensive': ['expensiv', 'exspensive', 'expensive'],
    'famous': ['famos', 'famus', 'famous'],
    'frightened': ['fritened', 'frightend', 'frightened'],
    'hungry': ['hongry', 'hungri', 'hungry'],
    'interesting': ['intresting', 'intersting', 'interesting'],
    'jealous': ['jelous', 'jealos', 'jealous'],
    'lonely': ['lonley', 'loneli', 'lonely'],
    'nervous': ['nervos', 'nervus', 'nervous'],
    'perfect': ['perfec', 'perfict', 'perfect'],
    'popular': ['populer', 'poplar', 'popular'],
    'quiet': ['quite', 'kwiet', 'quiet'],
    'scared': ['skared', 'scaired', 'scared'],
    'terrible': ['terible', 'terrable', 'terrible'],
    'tired': ['tyred', 'tierd', 'tired'],
    'wonderful': ['wonderfull', 'wunderful', 'wonderful'],
    
    # Common word form variations
    'shiny': ['shining', 'shin', 'shiny'],
}


def get_pronunciation_variants(word: str) -> list[str]:
    """
    Get pronunciation variants for an English word.
    
    Args:
        word: The word to get variants for (normalized, lowercase)
        
    Returns:
        List of pronunciation variants including the original word
    """
    normalized = word.lower().strip()
    variants = ENGLISH_PRONUNCIATION_DICT.get(normalized, [])
    
    # Always include the original word if not already in variants
    if normalized not in variants:
        return [normalized] + variants
    
    return variants


def is_pronunciation_match(spoken: str, expected: str) -> bool:
    """
    Check if spoken word matches expected word considering pronunciation variants.
    
    Args:
        spoken: The word that was spoken (normalized, lowercase)
        expected: The expected word (normalized, lowercase)
        
    Returns:
        True if spoken word matches expected word or any of its variants
    """
    if not spoken or not expected:
        return False
    
    spoken_norm = spoken.lower().strip()
    expected_norm = expected.lower().strip()
    
    # Exact match
    if spoken_norm == expected_norm:
        return True
    
    # Check if spoken word is a variant of expected word
    expected_variants = get_pronunciation_variants(expected_norm)
    if spoken_norm in expected_variants:
        return True
    
    # Check reverse - if expected word is a variant of spoken word
    spoken_variants = get_pronunciation_variants(spoken_norm)
    if expected_norm in spoken_variants:
        return True
    
    return False


if __name__ == "__main__":
    # Test the dictionary
    print("English Pronunciation Dictionary Test")
    print("=" * 60)
    
    test_words = ['a', 'the', 'this', 'that', 'looked', 'walked']
    for word in test_words:
        variants = get_pronunciation_variants(word)
        print(f"'{word}': {variants}")
    
    print("\n" + "=" * 60)
    print("Pronunciation Matching Test")
    print("=" * 60)
    
    test_pairs = [
        ('a', 'a'),
        ('ah', 'a'),
        ('da', 'the'),
        ('dis', 'this'),
        ('dat', 'that'),
        ('look', 'looked'),
        ('walk', 'walked'),
    ]
    
    for spoken, expected in test_pairs:
        match = is_pronunciation_match(spoken, expected)
        print(f"'{spoken}' vs '{expected}': {match}")

