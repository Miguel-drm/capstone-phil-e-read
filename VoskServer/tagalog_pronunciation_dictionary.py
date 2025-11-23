#!/usr/bin/env python3
"""
Tagalog Pronunciation Dictionary
================================

Comprehensive dictionary of Tagalog words with common pronunciation variants.
Used by the server to match spoken words to expected words, handling:
- Child mispronunciations
- Dialectal variations
- Common speech patterns

Usage:
    from tagalog_pronunciation_dictionary import TAGALOG_PRONUNCIATION_DICT
    
    variants = TAGALOG_PRONUNCIATION_DICT.get('tao', [])
    # Returns: ['tau', 'tawo', 'tao']
"""

# ============================================================================
# TAGALOG PRONUNCIATION DICTIONARY
# ============================================================================

TAGALOG_PRONUNCIATION_DICT: dict[str, list[str]] = {
    # Single letters and common sounds
    'a': ['a', 'ah', 'ay'],
    'i': ['i', 'e', 'ee'],
    'o': ['o', 'oh', 'u'],
    'u': ['u', 'oo', 'o'],
    'e': ['e', 'i', 'eh'],
    
    # Pronouns and particles
    'ako': ['aku', 'ako'],
    'ikaw': ['ikao', 'ka', 'ikaw'],
    'siya': ['sya', 'siya'],
    'kami': ['kame', 'kami'],
    'tayo': ['tayu', 'tayo'],
    'kayo': ['kayu', 'kayo'],
    'sila': ['sela', 'sila'],
    'ko': ['ku', 'ko'],
    'mo': ['mu', 'mo'],
    'niya': ['nya', 'niya'],
    'namin': ['namen', 'namin'],
    'natin': ['naten', 'natin'],
    'ninyo': ['ninyu', 'ninyo'],
    'nila': ['nela', 'nila'],
    'ang': ['an', 'ang'],
    'ng': ['nang', 'ng'],
    'sa': ['sang', 'sa'],
    'mga': ['manga', 'mga'],
    'ay': ['ai', 'ay'],
    'na': ['nang', 'na'],
    'pa': ['pang', 'pa'],
    'ba': ['bang', 'ba'],
    'po': ['pu', 'po'],
    'opo': ['opu', 'opo'],
    
    # People and Family
    'tao': ['tau', 'tawo', 'tao'],
    'bata': ['bat', 'batang', 'bata'],
    'nanay': ['nay', 'inay', 'nana', 'nanay'],
    'tatay': ['tay', 'itay', 'tata', 'tatay'],
    'ina': ['inang', 'nay', 'ina'],
    'ama': ['amang', 'tay', 'ama'],
    'kapatid': ['patid', 'kapatit', 'kapatid'],
    'ate': ['at', 'ateng', 'ate'],
    'kuya': ['koya', 'kuyang', 'kuya'],
    'lolo': ['lol', 'lulo', 'lolo'],
    'lola': ['lol', 'lula', 'lola'],
    'pamilya': ['pamilia', 'familia', 'pamilya'],
    'kaibigan': ['kaybigan', 'kibigan', 'kaibigan'],
    'kapitbahay': ['kapitbay', 'kapibahay', 'kapitbahay'],
    'guro': ['guru', 'goro', 'guro'],
    'estudyante': ['istudyante', 'estudyanti', 'estudyante'],
    
    # Animals
    'aso': ['asong', 'asu', 'aso'],
    'pusa': ['pusang', 'posa', 'pusa'],
    'ibon': ['ibong', 'ebon', 'ibon'],
    'isda': ['isdang', 'esda', 'isda'],
    'manok': ['manuk', 'manok'],
    'baboy': ['babuy', 'baboi', 'baboy'],
    'baka': ['bakang', 'bak', 'baka'],
    'kabayo': ['kabayu', 'kabayo'],
    'kambing': ['kambin', 'kambing'],
    'kalabaw': ['kalabao', 'kalabaw'],
    'daga': ['dagat', 'dag', 'daga'],
    'paruparo': ['paro-paro', 'paruparu', 'paruparo'],
    'langgam': ['langam', 'langgam'],
    'bubuyog': ['bubuyug', 'bubuyok', 'bubuyog'],
    'gagamba': ['gagamb', 'gagamba'],
    'palaka': ['palak', 'palaka'],
    'ahas': ['ahas'],
    'pagong': ['pagung', 'pagong'],
    'unggoy': ['ungoy', 'ungguy', 'unggoy'],
    
    # Body Parts
    'ulo': ['ulu', 'olo', 'ulo'],
    'mata': ['mat', 'matang', 'mata'],
    'ilong': ['ilung', 'elong', 'ilong'],
    'tenga': ['tinga', 'tengga', 'tenga'],
    'bibig': ['bibik', 'bebig', 'bibig'],
    'ngipin': ['ngepin', 'nipin', 'ngipin'],
    'dila': ['dil', 'dela', 'dila'],
    'leeg': ['lig', 'leeg'],
    'balikat': ['balekat', 'balikat'],
    'braso': ['brasu', 'baraso', 'braso'],
    'kamay': ['kamey', 'kamay'],
    'daliri': ['dalere', 'daliri'],
    'kuko': ['kuku', 'koko', 'kuko'],
    'tiyan': ['tyan', 'tiyan'],
    'likod': ['likud', 'lekod', 'likod'],
    'paa': ['pa', 'paang', 'paa'],
    'tuhod': ['tuhud', 'tohod', 'tuhod'],
    'binti': ['bente', 'binti'],
    'puso': ['pusu', 'poso', 'puso'],
    'baga': ['bag', 'baga'],
    
    # Food and Drinks
    'pagkain': ['pagkaen', 'pakain', 'pagkain'],
    'kanin': ['kanen', 'kaning', 'kanin'],
    'tinapay': ['tinapey', 'tinapai', 'tinapay'],
    'ulam': ['olam', 'ulam'],
    'gulay': ['golay', 'gulai', 'gulay'],
    'prutas': ['protas', 'frutas', 'prutas'],
    'saging': ['sagin', 'saging'],
    'mansanas': ['manzanas', 'mansanas'],
    'mangga': ['manga', 'mangga'],
    'ubas': ['obas', 'ubas'],
    'pakwan': ['pakoan', 'pakwan'],
    'karne': ['karni', 'carne', 'karne'],
    'itlog': ['etlog', 'itlug', 'itlog'],
    'gatas': ['gatas'],
    'tubig': ['tobig', 'tubeg', 'tubig'],
    'kape': ['kapi', 'coffee', 'kape'],
    'tsaa': ['tsa', 'tea', 'tsaa'],
    'sopas': ['sopa', 'sopas'],
    'adobo': ['adobu', 'adobo'],
    
    # Places and Objects
    'bahay': ['bahey', 'bahai', 'bahay'],
    'paaralan': ['paralan', 'eskwela', 'paaralan'],
    'silid': ['seled', 'selid', 'silid'],
    'kusina': ['kosina', 'kusena', 'kusina'],
    'banyo': ['banyu', 'banio', 'banyo'],
    'sala': ['sal', 'salang', 'sala'],
    'kwarto': ['kuarto', 'kwarto'],
    'pinto': ['pentu', 'pinto'],
    'bintana': ['bentana', 'bintana'],
    'hagdan': ['hagdang', 'agdan', 'hagdan'],
    'bubong': ['bubung', 'bobong', 'bubong'],
    'sahig': ['saheg', 'saig', 'sahig'],
    'dingding': ['dengding', 'dinding', 'dingding'],
    'mesa': ['misa', 'mesa'],
    'silya': ['silyang', 'silia', 'silya'],
    'kama': ['kamang', 'kama'],
    'unan': ['onan', 'unang', 'unan'],
    'kumot': ['kumut', 'komot', 'kumot'],
    'libro': ['lebro', 'libro'],
    'lapis': ['lapes', 'lapis'],
    'papel': ['papil', 'paper', 'papel'],
    'bag': ['beg', 'bag'],
    'sapatos': ['sapatus', 'sapatos'],
    'damit': ['damet', 'damit'],
    'sombrero': ['sumbrero', 'sombrero'],
    
    # Verbs - Common Actions
    'kumain': ['kumaen', 'kain', 'kumain'],
    'uminom': ['uminum', 'inom', 'uminom'],
    'maglaro': ['maglaru', 'laro', 'maglaro'],
    'matulog': ['matolog', 'tulog', 'matulog'],
    'gumising': ['gumesing', 'gising', 'gumising'],
    'maligo': ['malegu', 'ligo', 'maligo'],
    'magsipilyo': ['magsepilyo', 'sipilyo', 'magsipilyo'],
    'maglinis': ['maglenes', 'linis', 'maglinis'],
    'maglaba': ['maglabang', 'laba', 'maglaba'],
    'magluto': ['magloto', 'luto', 'magluto'],
    'kumanta': ['kumantang', 'kanta', 'kumanta'],
    'sumayaw': ['sumayao', 'sayaw', 'sumayaw'],
    'tumakbo': ['tumakbu', 'takbo', 'tumakbo'],
    'lumakad': ['lakad', 'lumakad'],
    'tumalon': ['tumalun', 'talon', 'tumalon'],
    'umupo': ['umupu', 'upo', 'umupo'],
    'tumayo': ['tumayu', 'tayo', 'tumayo'],
    'humiga': ['humega', 'higa', 'humiga'],
    'magsulat': ['magsolat', 'sulat', 'magsulat'],
    'magbasa': ['magbas', 'basa', 'magbasa'],
    'pumunta': ['pomunta', 'punta', 'pumunta'],
    'umuwi': ['umuwe', 'uwi', 'umuwi'],
    'dumating': ['domating', 'dating', 'dumating'],
    'umalis': ['omalis', 'alis', 'umalis'],
    'bumalik': ['bomalik', 'balik', 'bumalik'],
    'tumingin': ['tomengin', 'tingin', 'tumingin'],
    'makinig': ['makenig', 'kinig', 'makinig'],
    'magsalita': ['magsalit', 'salita', 'magsalita'],
    'tumawa': ['tomawa', 'tawa', 'tumawa'],
    'umiyak': ['umeyak', 'iyak', 'umiyak'],
    'ngumiti': ['ngomiti', 'ngiti', 'ngumiti'],
    'sumigaw': ['somigaw', 'sigaw', 'sumigaw'],
    'bumukas': ['bomukas', 'bukas', 'bumukas'],
    'magsara': ['magsarang', 'sara', 'magsara'],
    'kumuha': ['komuha', 'kuha', 'kumuha'],
    'magbigay': ['magbegay', 'bigay', 'magbigay'],
    'tumanggap': ['tomanggap', 'tanggap', 'tumanggap'],
    'magtanong': ['tanong', 'magtanong'],
    'sumagot': ['somagot', 'sagot', 'sumagot'],
    'mag-aral': ['magaral', 'aral', 'mag-aral'],
    
    # Adjectives
    'maganda': ['magand', 'magandang', 'maganda'],
    'pangit': ['panget', 'pangit'],
    'mabuti': ['mabote', 'buti', 'mabuti'],
    'masama': ['masam', 'sama', 'masama'],
    'malaki': ['malake', 'laki', 'malaki'],
    'maliit': ['malet', 'liit', 'maliit'],
    'mataba': ['matab', 'taba', 'mataba'],
    'payat': ['payat'],
    'mataas': ['matas', 'taas', 'mataas'],
    'mababa': ['mabab', 'baba', 'mababa'],
    'mahaba': ['mahab', 'haba', 'mahaba'],
    'maikli': ['maikle', 'ikli', 'maikli'],
    'mainit': ['mainet', 'init', 'mainit'],
    'malamig': ['malameg', 'lamig', 'malamig'],
    'masaya': ['masay', 'saya', 'masaya'],
    'malungkot': ['malongkot', 'lungkot', 'malungkot'],
    'galit': ['galet', 'galit'],
    'takot': ['takut', 'takot'],
    'matapang': ['tapang', 'matapang'],
    'mahiyain': ['mahiyaen', 'hiyain', 'mahiyain'],
    'matalino': ['matalenu', 'talino', 'matalino'],
    'bobo': ['bubu', 'bobo'],
    'mabait': ['mabaet', 'bait', 'mabait'],
    'masungit': ['masunget', 'sungit', 'masungit'],
    'maingay': ['maengay', 'ingay', 'maingay'],
    
    # Colors
    'puti': ['pote', 'puti'],
    'itim': ['etem', 'itim'],
    'pula': ['pol', 'pula'],
    'asul': ['asol', 'blue', 'asul'],
    'dilaw': ['delao', 'yellow', 'dilaw'],
    'berde': ['birdi', 'green', 'berde'],
    'kahel': ['kael', 'orange', 'kahel'],
    'lila': ['lela', 'purple', 'lila'],
    'rosas': ['rusas', 'pink', 'rosas'],
    'kulay': ['kolay', 'kulai', 'kulay'],
    'abo': ['abu', 'gray', 'abo'],
    'kayumanggi': ['kayomangi', 'brown', 'kayumanggi'],
    
    # Numbers
    'isa': ['es', 'isang', 'isa'],
    'dalawa': ['dalawang', 'dalwa', 'dalawa'],
    'tatlo': ['tatlu', 'tatlong', 'tatlo'],
    'apat': ['apat'],
    'lima': ['lem', 'limang', 'lima'],
    'anim': ['anem', 'anim'],
    'pito': ['petu', 'pitong', 'pito'],
    'walo': ['walu', 'walong', 'walo'],
    'siyam': ['siyam'],
    'sampu': ['sampo', 'sampung', 'sampu'],
    'labingisa': ['labing-isa', 'labingesa', 'labingisa'],
    'dalawampu': ['dalawampo', 'dalawampu'],
    'tatlumpu': ['tatlompo', 'tatlumpu'],
    'apatnapu': ['apatnapo', 'apatnapu'],
    'limampu': ['limampo', 'limampu'],
    'animnapu': ['animnapo', 'animnapu'],
    'pitumpu': ['pitompo', 'pitumpu'],
    'walumpu': ['walompo', 'walumpu'],
    'siyamnapu': ['siyamnapo', 'siyamnapu'],
    'daan': ['dan', 'daang', 'daan'],
    'libo': ['lebu', 'libong', 'libo'],
    
    # Time Words
    'araw': ['arao', 'araw'],
    'gabi': ['gabe', 'gabi'],
    'umaga': ['omaga', 'umaga'],
    'hapon': ['hapun', 'hapon'],
    'tanghali': ['tanggali', 'tanghali'],
    'buwan': ['buan', 'buwan'],
    'taon': ['taun', 'taon'],
    'linggo': ['lingo', 'linggo'],
    'oras': ['uras', 'oras'],
    'minuto': ['minoto', 'minuto'],
    'segundo': ['sigundo', 'segundo'],
    'ngayon': ['ngayun', 'ngayon'],
    'bukas': ['bokas', 'bukas'],
    'kahapon': ['kahapun', 'kahapon'],
    'mamaya': ['mamay', 'mamaya'],
    'kanina': ['kanena', 'kanina'],
    'mamayangabi': ['mamayang-gabi', 'mamayangabe', 'mamayangabi'],
    
    # Demonstratives
    'ito': ['etu', 'itong', 'ito'],
    'iyan': ['yan', 'iyang', 'iyan'],
    'iyon': ['yun', 'iyong', 'iyon'],
    'dito': ['detu', 'ditong', 'dito'],
    'diyan': ['dyan', 'diyang', 'diyan'],
    'doon': ['dun', 'doong', 'doon'],
    'nandito': ['nandetu', 'nandito'],
    'nandiyan': ['nandyan', 'nandiyan'],
    'nandoon': ['nandun', 'nandoon'],
    'heto': ['eto', 'hetu', 'heto'],
    'hayan': ['ayan', 'hayan'],
    'hayun': ['ayun', 'hayun'],
    
    # Question Words
    'ano': ['anu', 'ano'],
    'sino': ['sinu', 'sino'],
    'saan': ['san', 'saan'],
    'kailan': ['kelan', 'kailan'],
    'bakit': ['baket', 'bakit'],
    'paano': ['pano', 'paanu', 'paano'],
    'ilan': ['elan', 'ilang', 'ilan'],
    'alin': ['alen', 'aling', 'alin'],
    'kanino': ['kanenu', 'kanino'],
    'magkano': ['magkanu', 'magkano'],
    
    # Conjunctions and Connectors
    'at': ['at'],
    'o': ['u', 'o'],
    'pero': ['peru', 'pero'],
    'ngunit': ['ngonet', 'ngunit'],
    'kaya': ['kay', 'kaya'],
    'dahil': ['dahel', 'dahil'],
    'kung': ['kong', 'kung'],
    'kapag': ['pag', 'kapag'],
    'habang': ['habang'],
    'para': ['par', 'para'],
    'upang': ['opang', 'upang'],
    'nang': ['ng', 'nang'],
    'noong': ['nung', 'noong'],
    'sapagkat': ['sapagkat'],
    'subalit': ['sobalit', 'subalit'],
    'kahit': ['kahet', 'kahit'],
    'bagaman': ['bagaman'],
    
    # Common Adverbs
    'mabilis': ['mabeles', 'bilis', 'mabilis'],
    'mabagal': ['bagal', 'mabagal'],
    'palagi': ['palage', 'lagi', 'palagi'],
    'minsan': ['mensan', 'minsan'],
    'kadalasan': ['dalasan', 'kadalasan'],
    'bihira': ['behera', 'bihira'],
    'lagi': ['lage', 'lagi'],
    'hindi': ['hende', 'di', 'hindi'],
    'oo': ['o', 'oo'],
    'wala': ['wal', 'wala'],
    'mayroon': ['mayron', 'meron', 'mayroon'],
    'meron': ['miron', 'meron'],
    
    # More common words
    'naman': ['naman'],
    'lang': ['lang'],
    'din': ['rin', 'din'],
    'rin': ['din', 'rin'],
    'kasi': ['kase', 'kasi'],
    'talaga': ['talag', 'talaga'],
    'sobra': ['sobrang', 'sobra'],
    'lahat': ['lahat'],
    'bawat': ['bawat'],
    'ibang': ['iba', 'ibang'],
    'sarili': ['sarele', 'sarili'],
    'mundo': ['mondo', 'mundo'],
    'buhay': ['buhey', 'buhay'],
    
    # Additional common words
    'may': ['mey', 'may'],
    'walang': ['walang', 'wala'],
    'marami': ['marame', 'marami'],
    'konti': ['konte', 'konti'],
    'ibig': ['ebig', 'ibig'],
    'gusto': ['gosto', 'gusto'],
    'ayaw': ['ayao', 'ayaw'],
    'kailangan': ['kelangan', 'kailangan'],
    'pwede': ['puwede', 'pwedi', 'pwede'],
    'dapat': ['dapot', 'dapat'],
    'maaari': ['maare', 'maaari'],
    'sana': ['san', 'sana'],
    'lungga': ['longga', 'lunga', 'lungga'],
    'gutom': ['gotom', 'gutum', 'gutom'],
    'naglalakad': ['naglalakad', 'naglakad', 'lakad'],
    'nakita': ['naketa', 'nakita'],
    'sinabi': ['sinabe', 'sinabi'],
}


def get_pronunciation_variants(word: str) -> list[str]:
    """
    Get pronunciation variants for a Tagalog word.
    
    Args:
        word: The word to get variants for (normalized, lowercase)
        
    Returns:
        List of pronunciation variants including the original word
    """
    normalized = word.lower().strip()
    variants = TAGALOG_PRONUNCIATION_DICT.get(normalized, [])
    
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
    print("Tagalog Pronunciation Dictionary Test")
    print("=" * 60)
    
    test_words = ['tao', 'bata', 'nanay', 'kumain', 'maganda']
    for word in test_words:
        variants = get_pronunciation_variants(word)
        print(f"'{word}': {variants}")
    
    print("\n" + "=" * 60)
    print("Pronunciation Matching Test")
    print("=" * 60)
    
    test_pairs = [
        ('tau', 'tao'),
        ('bat', 'bata'),
        ('nay', 'nanay'),
        ('kumaen', 'kumain'),
        ('magand', 'maganda'),
    ]
    
    for spoken, expected in test_pairs:
        match = is_pronunciation_match(spoken, expected)
        print(f"'{spoken}' vs '{expected}': {match}")
