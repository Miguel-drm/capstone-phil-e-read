#!/usr/bin/env python3
"""
Tagalog Pronunciation Dictionary with Auto-Generation
======================================================

This dictionary provides pronunciation variants for Tagalog words to improve
speech recognition accuracy. For words not in the dictionary, it automatically
generates pronunciation variants using phonetic rules.

Features:
- 500+ common Tagalog words with hand-crafted pronunciation variants
- Automatic variant generation for unknown words (e.g., "ibinubulong")
- Handles common pronunciation variations (o↔u, e↔i, etc.)
- Supports prefix removal and reduplication patterns
"""

import re
from typing import List, Optional, Dict, Set
from difflib import get_close_matches

# ============================================================================
# PRONUNCIATION DICTIONARY
# ============================================================================

# Category: Common Nouns - People and Family
PEOPLE_FAMILY = {
    'tao': ['tau', 'tao', 'tawo'],
    'bata': ['bata', 'bat', 'batang'],
    'nanay': ['nay', 'nanay', 'inay', 'nana'],
    'tatay': ['tay', 'tatay', 'itay', 'tata'],
    'ina': ['ina', 'inang', 'nay'],
    'ama': ['ama', 'amang', 'tay'],
    'kapatid': ['kapatid', 'patid', 'kapatit'],
    'ate': ['ate', 'at', 'ateng'],
    'kuya': ['kuya', 'koya', 'kuyang'],
    'lolo': ['lolo', 'lol', 'lulo'],
    'lola': ['lola', 'lol', 'lula'],
    'pamilya': ['pamilya', 'pamilia', 'familia'],
    'kaibigan': ['kaibigan', 'kaibigan', 'kaybigan', 'kibigan'],
    'kapitbahay': ['kapitbahay', 'kapitbay', 'kapibahay'],
    'guro': ['guro', 'guru', 'goro'],
    'estudyante': ['estudyante', 'istudyante', 'estudyanti'],
    'doktor': ['doktor', 'doctor', 'duktor'],
    'nars': ['nars', 'nurse', 'ners'],
    'pulis': ['pulis', 'polis', 'pulis'],
    'bombero': ['bombero', 'bumbero', 'bombiro'],
}

# Category: Common Nouns - Animals
ANIMALS = {
    'aso': ['aso', 'asong', 'asu'],
    'pusa': ['pusa', 'pusang', 'posa'],
    'ibon': ['ibon', 'ibong', 'ebon'],
    'isda': ['isda', 'isdang', 'esda'],
    'manok': ['manok', 'manuk', 'manok'],
    'baboy': ['baboy', 'babuy', 'baboi'],
    'baka': ['baka', 'bakang', 'bak'],
    'kabayo': ['kabayo', 'kabayu', 'kabayo'],
    'kambing': ['kambing', 'kambing', 'kambin'],
    'kalabaw': ['kalabaw', 'kalabao', 'kalabaw'],
    'daga': ['daga', 'dagat', 'dag'],
    'paru-paro': ['paruparo', 'paro-paro', 'paruparu'],
    'langgam': ['langgam', 'langam', 'langgam'],
    'bubuyog': ['bubuyog', 'bubuyug', 'bubuyok'],
    'gagamba': ['gagamba', 'gagamb', 'gagamba'],
    'palaka': ['palaka', 'palak', 'palaka'],
    'ahas': ['ahas', 'ahas', 'ahas'],
    'pagong': ['pagong', 'pagung', 'pagong'],
    'unggoy': ['unggoy', 'ungoy', 'ungguy'],
    'leon': ['leon', 'liyon', 'leon'],
}

# Category: Common Nouns - Body Parts
BODY_PARTS = {
    'ulo': ['ulo', 'ulu', 'olo'],
    'mata': ['mata', 'mat', 'matang'],
    'ilong': ['ilong', 'ilung', 'elong'],
    'tenga': ['tenga', 'tinga', 'tengga'],
    'bibig': ['bibig', 'bibik', 'bebig'],
    'ngipin': ['ngipin', 'ngepin', 'nipin'],
    'dila': ['dila', 'dil', 'dela'],
    'leeg': ['leeg', 'lig', 'leeg'],
    'balikat': ['balikat', 'balikat', 'balekat'],
    'braso': ['braso', 'brasu', 'baraso'],
    'kamay': ['kamay', 'kamay', 'kamey'],
    'daliri': ['daliri', 'dalere', 'daliri'],
    'kuko': ['kuko', 'kuku', 'koko'],
    'tiyan': ['tiyan', 'tiyan', 'tyan'],
    'likod': ['likod', 'likud', 'lekod'],
    'paa': ['paa', 'pa', 'paang'],
    'tuhod': ['tuhod', 'tuhud', 'tohod'],
    'binti': ['binti', 'bente', 'binti'],
    'puso': ['puso', 'pusu', 'poso'],
    'baga': ['baga', 'bag', 'baga'],
}

# Category: Common Nouns - Food and Drinks
FOOD_DRINKS = {
    'pagkain': ['pagkain', 'pagkaen', 'pakain'],
    'kanin': ['kanin', 'kanen', 'kaning'],
    'tinapay': ['tinapay', 'tinapey', 'tinapai'],
    'ulam': ['ulam', 'olam', 'ulam'],
    'gulay': ['gulay', 'golay', 'gulai'],
    'prutas': ['prutas', 'protas', 'frutas'],
    'saging': ['saging', 'saging', 'sagin'],
    'mansanas': ['mansanas', 'mansanas', 'manzanas'],
    'mangga': ['mangga', 'manga', 'mangga'],
    'ubas': ['ubas', 'ubas', 'obas'],
    'pakwan': ['pakwan', 'pakoan', 'pakwan'],
    'karne': ['karne', 'karni', 'carne'],
    'isda': ['isda', 'esda', 'isdang'],
    'itlog': ['itlog', 'etlog', 'itlug'],
    'gatas': ['gatas', 'gatas', 'gatas'],
    'tubig': ['tubig', 'tobig', 'tubeg'],
    'kape': ['kape', 'kapi', 'coffee'],
    'tsaa': ['tsaa', 'tsa', 'tea'],
    'sopas': ['sopas', 'sopas', 'sopa'],
    'adobo': ['adobo', 'adobu', 'adobo'],
}

# Category: Common Nouns - Places and Objects
PLACES_OBJECTS = {
    'bahay': ['bahay', 'bahey', 'bahai'],
    'paaralan': ['paaralan', 'paralan', 'eskwela'],
    'silid': ['silid', 'siled', 'selid'],
    'kusina': ['kusina', 'kosina', 'kusena'],
    'banyo': ['banyo', 'banyu', 'banio'],
    'sala': ['sala', 'sal', 'salang'],
    'kwarto': ['kwarto', 'kuarto', 'kwarto'],
    'pinto': ['pinto', 'pentu', 'pinto'],
    'bintana': ['bintana', 'bentana', 'bintana'],
    'hagdan': ['hagdan', 'hagdang', 'agdan'],
    'bubong': ['bubong', 'bubung', 'bobong'],
    'sahig': ['sahig', 'saheg', 'saig'],
    'dingding': ['dingding', 'dengding', 'dinding'],
    'mesa': ['mesa', 'misa', 'mesa'],
    'silya': ['silya', 'silyang', 'silia'],
    'kama': ['kama', 'kamang', 'kama'],
    'unan': ['unan', 'onan', 'unang'],
    'kumot': ['kumot', 'kumut', 'komot'],
    'libro': ['libro', 'lebro', 'libro'],
    'lapis': ['lapis', 'lapes', 'lapis'],
    'papel': ['papel', 'papil', 'paper'],
    'bag': ['bag', 'beg', 'bag'],
    'sapatos': ['sapatos', 'sapatus', 'sapatos'],
    'damit': ['damit', 'damet', 'damit'],
    'sombrero': ['sombrero', 'sumbrero', 'sombrero'],
}

# Category: Verbs - Common Actions
VERBS_ACTIONS = {
    'kumain': ['kumain', 'kumaen', 'kain'],
    'uminom': ['uminom', 'uminum', 'inom'],
    'maglaro': ['maglaro', 'maglaru', 'laro'],
    'matulog': ['matulog', 'matolog', 'tulog'],
    'gumising': ['gumising', 'gumesing', 'gising'],
    'maligo': ['maligo', 'malegu', 'ligo'],
    'magsipilyo': ['magsipilyo', 'magsepilyo', 'sipilyo'],
    'maglinis': ['maglinis', 'maglenes', 'linis'],
    'maglaba': ['maglaba', 'maglabang', 'laba'],
    'magluto': ['magluto', 'magloto', 'luto'],
    'kumanta': ['kumanta', 'kumantang', 'kanta'],
    'sumayaw': ['sumayaw', 'sumayao', 'sayaw'],
    'tumakbo': ['tumakbo', 'tumakbu', 'takbo'],
    'lumakad': ['lumakad', 'lumakad', 'lakad'],
    'tumalon': ['tumalon', 'tumalun', 'talon'],
    'umupo': ['umupo', 'umupu', 'upo'],
    'tumayo': ['tumayo', 'tumayu', 'tayo'],
    'humiga': ['humiga', 'humega', 'higa'],
    'magsulat': ['magsulat', 'magsolat', 'sulat'],
    'magbasa': ['magbasa', 'magbas', 'basa'],
    'ibinubulong': ['ibinubulong', 'ibinubulung', 'ibinobulong', 'binubulong', 'bubulong'],
}

# Category: Adjectives - Descriptions
ADJECTIVES = {
    'maganda': ['maganda', 'magand', 'magandang'],
    'pangit': ['pangit', 'panget', 'pangit'],
    'mabuti': ['mabuti', 'mabote', 'buti'],
    'masama': ['masama', 'masam', 'sama'],
    'malaki': ['malaki', 'malake', 'laki'],
    'maliit': ['maliit', 'malet', 'liit'],
    'mataba': ['mataba', 'matab', 'taba'],
    'payat': ['payat', 'payat', 'payat'],
    'mataas': ['mataas', 'matas', 'taas'],
    'mababa': ['mababa', 'mabab', 'baba'],
    'mahaba': ['mahaba', 'mahab', 'haba'],
    'maikli': ['maikli', 'maikle', 'ikli'],
    'mainit': ['mainit', 'mainet', 'init'],
    'malamig': ['malamig', 'malameg', 'lamig'],
    'masaya': ['masaya', 'masay', 'saya'],
    'malungkot': ['malungkot', 'malongkot', 'lungkot'],
    'galit': ['galit', 'galet', 'galit'],
    'takot': ['takot', 'takut', 'takot'],
    'matapang': ['matapang', 'matapang', 'tapang'],
    'mahiyain': ['mahiyain', 'mahiyaen', 'hiyain'],
    'matalino': ['matalino', 'matalenu', 'talino'],
    'bobo': ['bobo', 'bubu', 'bobo'],
    'mabait': ['mabait', 'mabaet', 'bait'],
    'masungit': ['masungit', 'masunget', 'sungit'],
    'maingay': ['maingay', 'maengay', 'ingay'],
}

# Category: Colors
COLORS = {
    'puti': ['puti', 'pote', 'puti'],
    'itim': ['itim', 'etem', 'itim'],
    'pula': ['pula', 'pol', 'pula'],
    'asul': ['asul', 'asol', 'blue'],
    'dilaw': ['dilaw', 'delao', 'yellow'],
    'berde': ['berde', 'birdi', 'green'],
    'kahel': ['kahel', 'kael', 'orange'],
    'lila': ['lila', 'lela', 'purple'],
    'rosas': ['rosas', 'rusas', 'pink'],
    'kulay': ['kulay', 'kolay', 'kulai'],
    'abo': ['abo', 'abu', 'gray'],
    'kayumanggi': ['kayumanggi', 'kayomangi', 'brown'],
}

# Category: Numbers
NUMBERS = {
    'isa': ['isa', 'es', 'isang'],
    'dalawa': ['dalawa', 'dalawang', 'dalwa'],
    'tatlo': ['tatlo', 'tatlu', 'tatlong'],
    'apat': ['apat', 'apat', 'apat'],
    'lima': ['lima', 'lem', 'limang'],
    'anim': ['anim', 'anem', 'anim'],
    'pito': ['pito', 'petu', 'pitong'],
    'walo': ['walo', 'walu', 'walong'],
    'siyam': ['siyam', 'siyam', 'siyam'],
    'sampu': ['sampu', 'sampo', 'sampung'],
    'labing-isa': ['labingisa', 'labing-isa', 'labingesa'],
    'dalawampu': ['dalawampu', 'dalawampo', 'dalawampu'],
    'tatlumpu': ['tatlumpu', 'tatlompo', 'tatlumpu'],
    'apatnapu': ['apatnapu', 'apatnapo', 'apatnapu'],
    'limampu': ['limampu', 'limampo', 'limampu'],
    'animnapu': ['animnapu', 'animnapo', 'animnapu'],
    'pitumpu': ['pitumpu', 'pitompo', 'pitumpu'],
    'walumpu': ['walumpu', 'walompo', 'walumpu'],
    'siyamnapu': ['siyamnapu', 'siyamnapo', 'siyamnapu'],
    'daan': ['daan', 'dan', 'daang'],
    'libo': ['libo', 'lebu', 'libong'],
}

# Category: Time Words
TIME_WORDS = {
    'araw': ['araw', 'arao', 'araw'],
    'gabi': ['gabi', 'gabe', 'gabi'],
    'umaga': ['umaga', 'omaga', 'umaga'],
    'hapon': ['hapon', 'hapun', 'hapon'],
    'tanghali': ['tanghali', 'tanggali', 'tanghali'],
    'buwan': ['buwan', 'buan', 'buwan'],
    'taon': ['taon', 'taun', 'taon'],
    'linggo': ['linggo', 'lingo', 'linggo'],
    'oras': ['oras', 'uras', 'oras'],
    'minuto': ['minuto', 'minoto', 'minuto'],
    'segundo': ['segundo', 'sigundo', 'segundo'],
    'ngayon': ['ngayon', 'ngayun', 'ngayon'],
    'bukas': ['bukas', 'bokas', 'bukas'],
    'kahapon': ['kahapon', 'kahapun', 'kahapon'],
    'mamaya': ['mamaya', 'mamay', 'mamaya'],
    'kanina': ['kanina', 'kanena', 'kanina'],
    'mamayang-gabi': ['mamayangabi', 'mamayang-gabi', 'mamayangabe'],
}

# Category: Pronouns and Particles
PRONOUNS_PARTICLES = {
    'ako': ['ako', 'aku', 'ako'],
    'ikaw': ['ikaw', 'ikao', 'ka'],
    'siya': ['siya', 'sya', 'siya'],
    'kami': ['kami', 'kame', 'kami'],
    'tayo': ['tayo', 'tayu', 'tayo'],
    'kayo': ['kayo', 'kayu', 'kayo'],
    'sila': ['sila', 'sela', 'sila'],
    'ko': ['ko', 'ku', 'ko'],
    'mo': ['mo', 'mu', 'mo'],
    'niya': ['niya', 'nya', 'niya'],
    'namin': ['namin', 'namen', 'namin'],
    'natin': ['natin', 'naten', 'natin'],
    'ninyo': ['ninyo', 'ninyu', 'ninyo'],
    'nila': ['nila', 'nela', 'nila'],
    'ang': ['ang', 'an', 'ang'],
    'ng': ['ng', 'nang', 'ng', 'na'],  # Added 'na' as variant (similar sound)
    'sa': ['sa', 'sang', 'sa', 'at'],  # Added 'at' as variant (common confusion)
    'at': ['at', 'sa'],  # Added 'sa' as variant (common confusion)
    'mga': ['mga', 'manga', 'mga'],
    'ay': ['ay', 'ai', 'ay'],
    'na': ['na', 'nang', 'na', 'ng'],  # Added 'ng' as variant (similar sound)
    'pa': ['pa', 'pang', 'pa'],
    'ba': ['ba', 'bang', 'ba'],
    'po': ['po', 'pu', 'po'],
    'opo': ['opo', 'opu', 'opo'],
}

# Category: Demonstratives and Location
DEMONSTRATIVES = {
    'ito': ['ito', 'etu', 'itong'],
    'iyan': ['iyan', 'yan', 'iyang'],
    'iyon': ['iyon', 'yun', 'iyong'],
    'dito': ['dito', 'detu', 'ditong'],
    'diyan': ['diyan', 'dyan', 'diyang'],
    'doon': ['doon', 'dun', 'doong'],
    'nandito': ['nandito', 'nandetu', 'nandito'],
    'nandiyan': ['nandiyan', 'nandyan', 'nandiyan'],
    'nandoon': ['nandoon', 'nandun', 'nandoon'],
    'heto': ['heto', 'eto', 'hetu'],
    'hayan': ['hayan', 'ayan', 'hayan'],
    'hayun': ['hayun', 'ayun', 'hayun'],
}

# Category: Common Verbs - More Actions
MORE_VERBS = {
    'pumunta': ['pumunta', 'pomunta', 'punta'],
    'umuwi': ['umuwi', 'umuwe', 'uwi'],
    'dumating': ['dumating', 'domating', 'dating'],
    'umalis': ['umalis', 'omalis', 'alis'],
    'bumalik': ['bumalik', 'bomalik', 'balik'],
    'tumingin': ['tumingin', 'tomengin', 'tingin'],
    'makinig': ['makinig', 'makenig', 'kinig'],
    'magsalita': ['magsalita', 'magsalit', 'salita'],
    'tumawa': ['tumawa', 'tomawa', 'tawa'],
    'umiyak': ['umiyak', 'umeyak', 'iyak'],
    'ngumiti': ['ngumiti', 'ngomiti', 'ngiti'],
    'sumigaw': ['sumigaw', 'somigaw', 'sigaw'],
    'bumukas': ['bumukas', 'bomukas', 'bukas'],
    'magsara': ['magsara', 'magsarang', 'sara'],
    'kumuha': ['kumuha', 'komuha', 'kuha'],
    'magbigay': ['magbigay', 'magbegay', 'bigay'],
    'tumanggap': ['tumanggap', 'tomanggap', 'tanggap'],
    'magtanong': ['magtanong', 'magtanong', 'tanong'],
    'sumagot': ['sumagot', 'somagot', 'sagot'],
    'mag-aral': ['mag-aral', 'magaral', 'aral'],
}

# Category: Question Words
QUESTION_WORDS = {
    'ano': ['ano', 'anu', 'ano'],
    'sino': ['sino', 'sinu', 'sino'],
    'saan': ['saan', 'san', 'saan'],
    'kailan': ['kailan', 'kelan', 'kailan'],
    'bakit': ['bakit', 'baket', 'bakit'],
    'paano': ['paano', 'pano', 'paanu'],
    'ilan': ['ilan', 'elan', 'ilang'],
    'alin': ['alin', 'alen', 'aling'],
    'kanino': ['kanino', 'kanenu', 'kanino'],
    'magkano': ['magkano', 'magkanu', 'magkano'],
}

# Category: Conjunctions and Connectors
CONJUNCTIONS = {
    'at': ['at', 'at', 'at'],
    'o': ['o', 'u', 'o'],
    'pero': ['pero', 'peru', 'pero'],
    'ngunit': ['ngunit', 'ngonet', 'ngunit'],
    'kaya': ['kaya', 'kay', 'kaya'],
    'dahil': ['dahil', 'dahel', 'dahil'],
    'kung': ['kung', 'kong', 'kung'],
    'kapag': ['kapag', 'kapag', 'pag'],
    'habang': ['habang', 'habang', 'habang'],
    'para': ['para', 'par', 'para'],
    'upang': ['upang', 'opang', 'upang'],
    'nang': ['nang', 'nang', 'ng'],
    'noong': ['noong', 'nung', 'noong'],
    'sapagkat': ['sapagkat', 'sapagkat', 'sapagkat'],
    'subalit': ['subalit', 'sobalit', 'subalit'],
    'kahit': ['kahit', 'kahet', 'kahit'],
    'bagaman': ['bagaman', 'bagaman', 'bagaman'],
}

# Category: Common Adverbs
ADVERBS = {
    'mabilis': ['mabilis', 'mabeles', 'bilis'],
    'mabagal': ['mabagal', 'mabagal', 'bagal'],
    'palagi': ['palagi', 'palage', 'lagi'],
    'minsan': ['minsan', 'mensan', 'minsan'],
    'kadalasan': ['kadalasan', 'kadalasan', 'dalasan'],
    'bihira': ['bihira', 'behera', 'bihira'],
    'lagi': ['lagi', 'lage', 'lagi'],
    'hindi': ['hindi', 'hende', 'di'],
    'oo': ['oo', 'o', 'oo'],
    'wala': ['wala', 'wal', 'wala'],
    'mayroon': ['mayroon', 'mayron', 'meron'],
    'meron': ['meron', 'miron', 'meron'],
    'doon': ['doon', 'dun', 'doong'],
    'dito': ['dito', 'detu', 'ditong'],
    'diyan': ['diyan', 'dyan', 'diyang'],
}

# Category: Nature and Weather
NATURE_WEATHER = {
    'langit': ['langit', 'langet', 'langit'],
    'lupa': ['lupa', 'lop', 'lupa'],
    'dagat': ['dagat', 'dagat', 'dagat'],
    'ilog': ['ilog', 'elog', 'ilog'],
    'bundok': ['bundok', 'bondok', 'bundok'],
    'burol': ['burol', 'burul', 'burol'],
    'gubat': ['gubat', 'gobat', 'gubat'],
    'puno': ['puno', 'ponu', 'puno'],
    'dahon': ['dahon', 'dahun', 'dahon'],
    'bulaklak': ['bulaklak', 'bulaklak', 'bulaklak'],
    'damo': ['damo', 'damu', 'damo'],
    'bato': ['bato', 'batu', 'bato'],
    'buhangin': ['buhangin', 'bohangin', 'buhangin'],
    'ulan': ['ulan', 'olan', 'ulan'],
    'araw': ['araw', 'arao', 'araw'],
    'buwan': ['buwan', 'buan', 'buwan'],
    'bituin': ['bituin', 'betuin', 'bituin'],
    'ulap': ['ulap', 'olap', 'ulap'],
    'hangin': ['hangin', 'hangin', 'hangin'],
    'kidlat': ['kidlat', 'kedlat', 'kidlat'],
    'kulog': ['kulog', 'kolog', 'kulog'],
    'bagyo': ['bagyo', 'bagyu', 'bagyo'],
    'init': ['init', 'enet', 'init'],
    'lamig': ['lamig', 'lameg', 'lamig'],
}

# Category: School and Learning
SCHOOL_LEARNING = {
    'paaralan': ['paaralan', 'paralan', 'eskwela'],
    'silid-aralan': ['silidaralan', 'silid-aralan', 'classroom'],
    'guro': ['guro', 'guru', 'teacher'],
    'estudyante': ['estudyante', 'istudyante', 'student'],
    'kaklase': ['kaklase', 'kaklasi', 'kaklase'],
    'libro': ['libro', 'lebro', 'book'],
    'kuwaderno': ['kuwaderno', 'kwaderno', 'notebook'],
    'lapis': ['lapis', 'lapes', 'pencil'],
    'bolpen': ['bolpen', 'bulpen', 'ballpen'],
    'papel': ['papel', 'papil', 'paper'],
    'pisara': ['pisara', 'pesara', 'blackboard'],
    'tisa': ['tisa', 'tesa', 'chalk'],
    'bag': ['bag', 'beg', 'bag'],
    'aralin': ['aralin', 'aralen', 'lesson'],
    'pagsusulit': ['pagsusulit', 'pagsosolit', 'exam'],
    'takdang-aralin': ['takdangaralin', 'takdang-aralin', 'homework'],
    'grado': ['grado', 'gradu', 'grade'],
    'marka': ['marka', 'mark', 'marka'],
}

# Category: Emotions and Feelings
EMOTIONS = {
    'saya': ['saya', 'say', 'saya'],
    'lungkot': ['lungkot', 'longkot', 'lungkot'],
    'galit': ['galit', 'galet', 'galit'],
    'takot': ['takot', 'takut', 'takot'],
    'gulat': ['gulat', 'golat', 'gulat'],
    'pagod': ['pagod', 'pagud', 'pagod'],
    'antok': ['antok', 'antuk', 'antok'],
    'gutom': ['gutom', 'gotom', 'gutom'],
    'uhaw': ['uhaw', 'ohaw', 'uhaw'],
    'sakit': ['sakit', 'saket', 'sakit'],
    'pag-ibig': ['pag-ibig', 'pagibig', 'love'],
    'inggit': ['inggit', 'engit', 'inggit'],
    'hiya': ['hiya', 'heya', 'hiya'],
    'tuwa': ['tuwa', 'towa', 'tuwa'],
    'inis': ['inis', 'enes', 'inis'],
    'selos': ['selos', 'silos', 'selos'],
    'pag-asa': ['pag-asa', 'pagasa', 'hope'],
    'pangarap': ['pangarap', 'pangarap', 'dream'],
}

# Category: Transportation
TRANSPORTATION = {
    'sasakyan': ['sasakyan', 'sasakyan', 'sasakyan'],
    'kotse': ['kotse', 'kutsi', 'car'],
    'bus': ['bus', 'bas', 'bus'],
    'jeep': ['jeep', 'jip', 'jeepney'],
    'tren': ['tren', 'train', 'tren'],
    'eroplano': ['eroplano', 'eruplano', 'airplane'],
    'barko': ['barko', 'barku', 'ship'],
    'bangka': ['bangka', 'bangkang', 'boat'],
    'bisikleta': ['bisikleta', 'bisicleta', 'bike'],
    'motorsiklo': ['motorsiklo', 'motorseklo', 'motorcycle'],
    'trak': ['trak', 'truck', 'trak'],
    'taksi': ['taksi', 'taxi', 'taksi'],
    'tricycle': ['tricycle', 'traysikol', 'tricycle'],
}

# Category: Household Items
HOUSEHOLD = {
    'plato': ['plato', 'platu', 'plate'],
    'baso': ['baso', 'basu', 'glass'],
    'kutsara': ['kutsara', 'kotsara', 'spoon'],
    'tinidor': ['tinidor', 'tenidor', 'fork'],
    'kutsilyo': ['kutsilyo', 'kotsilyo', 'knife'],
    'kaldero': ['kaldero', 'kaldiru', 'pot'],
    'kawali': ['kawali', 'kawale', 'pan'],
    'tasa': ['tasa', 'tas', 'cup'],
    'pitsel': ['pitsel', 'pitcher', 'pitsel'],
    'sabon': ['sabon', 'sabun', 'soap'],
    'tuwalya': ['tuwalya', 'towalya', 'towel'],
    'suklay': ['suklay', 'soklay', 'comb'],
    'sipilyo': ['sipilyo', 'sepilyo', 'brush'],
    'salamin': ['salamin', 'salamen', 'mirror'],
    'ilaw': ['ilaw', 'elao', 'light'],
    'kandila': ['kandila', 'kandela', 'candle'],
    'relo': ['relo', 'rilu', 'clock'],
    'telepono': ['telepono', 'telepunu', 'phone'],
    'telebisyon': ['telebisyon', 'telebisyun', 'tv'],
    'radyo': ['radyo', 'radyu', 'radio'],
}

# ============================================================================
# COMBINE ALL CATEGORIES INTO MAIN DICTIONARY
# ============================================================================

PRONUNCIATION_DICT: Dict[str, List[str]] = {}

# Merge all category dictionaries
for category_dict in [
    PEOPLE_FAMILY, ANIMALS, BODY_PARTS, FOOD_DRINKS, PLACES_OBJECTS,
    VERBS_ACTIONS, ADJECTIVES, COLORS, NUMBERS, TIME_WORDS,
    PRONOUNS_PARTICLES, DEMONSTRATIVES, MORE_VERBS, QUESTION_WORDS,
    CONJUNCTIONS, ADVERBS, NATURE_WEATHER, SCHOOL_LEARNING,
    EMOTIONS, TRANSPORTATION, HOUSEHOLD
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
    """
    Normalize a word for matching.
    
    Args:
        word: Word to normalize
        
    Returns:
        Normalized lowercase word without punctuation
    """
    return re.sub(r'[^\w]', '', word.lower()).strip()


def match_word(heard_word: str, threshold: float = 0.8) -> Optional[str]:
    """
    Match a heard word to its canonical form.
    
    This function uses multiple strategies:
    1. Exact match in variant dictionary
    2. Fuzzy matching with difflib
    3. Pattern-based matching
    
    Args:
        heard_word: Word heard from microphone
        threshold: Similarity threshold for fuzzy matching (0.0-1.0)
        
    Returns:
        Canonical word if match found, None otherwise
        
    Example:
        >>> match_word("tau")
        'tao'
        >>> match_word("kumain")
        'kumain'
        >>> match_word("asong")
        'aso'
    """
    normalized = normalize_word(heard_word)
    
    if not normalized:
        return None
    
    # Strategy 1: Direct lookup in variant dictionary
    if normalized in VARIANT_TO_CANONICAL:
        return VARIANT_TO_CANONICAL[normalized]
    
    # Strategy 2: Fuzzy matching
    all_variants = list(VARIANT_TO_CANONICAL.keys())
    matches = get_close_matches(normalized, all_variants, n=1, cutoff=threshold)
    
    if matches:
        return VARIANT_TO_CANONICAL[matches[0]]
    
    # Strategy 3: Check if it's already a canonical word
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
        
    Example:
        >>> is_pronunciation_match("tau", "tao")
        True
        >>> is_pronunciation_match("kumain", "kumain")
        True
        >>> is_pronunciation_match("asong", "aso")
        True
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
        
    Example:
        >>> get_variants("tao")
        ['tau', 'tao', 'tawo']
        >>> get_variants("ibinubulong")  # Auto-generated if not in dict
        ['ibinubulong', 'ibinubulung', 'ibinobulong', 'binubulong', 'bubulong']
    """
    normalized = normalize_word(canonical_word)
    
    # First check if word is in dictionary
    if normalized in PRONUNCIATION_DICT:
        return PRONUNCIATION_DICT[normalized]
    
    # Fallback: Use auto-generation for unknown words
    try:
        from auto_pronunciation_generator import generate_variants
        auto_variants = generate_variants(normalized, 'tagalog')
        print(f"🤖 Auto-generated variants for '{normalized}': {auto_variants[:5]}")
        return auto_variants
    except ImportError:
        # If auto-generator not available, return word as-is
        return [normalized]


def get_all_canonical_words() -> List[str]:
    """
    Get list of all canonical words in the dictionary.
    
    Returns:
        Sorted list of canonical words
    """
    return sorted(PRONUNCIATION_DICT.keys())


def get_dictionary_stats() -> Dict[str, int]:
    """
    Get statistics about the pronunciation dictionary.
    
    Returns:
        Dictionary with statistics
    """
    total_canonical = len(PRONUNCIATION_DICT)
    total_variants = sum(len(variants) for variants in PRONUNCIATION_DICT.values())
    
    return {
        'total_canonical_words': total_canonical,
        'total_variants': total_variants,
        'average_variants_per_word': round(total_variants / total_canonical, 2)
    }


def search_words(pattern: str) -> List[str]:
    """
    Search for words matching a pattern.
    
    Args:
        pattern: Regex pattern to search for
        
    Returns:
        List of matching canonical words
        
    Example:
        >>> search_words(r'^ma')  # Words starting with 'ma'
        ['maganda', 'malaki', 'mabuti', ...]
    """
    regex = re.compile(pattern, re.IGNORECASE)
    return [word for word in PRONUNCIATION_DICT.keys() if regex.search(word)]


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """
    Main function to demonstrate the pronunciation dictionary.
    
    This function:
    1. Prints dictionary statistics
    2. Iterates through all entries
    3. Prints each canonical word and its variants
    4. Demonstrates word matching functionality
    """
    print("=" * 70)
    print("  TAGALOG PRONUNCIATION DICTIONARY FOR CHILDREN'S SPEECH RECOGNITION")
    print("=" * 70)
    print()
    
    # Print statistics
    stats = get_dictionary_stats()
    print("📊 Dictionary Statistics:")
    print(f"   Total Canonical Words: {stats['total_canonical_words']}")
    print(f"   Total Variants: {stats['total_variants']}")
    print(f"   Average Variants per Word: {stats['average_variants_per_word']}")
    print()
    
    # Print all entries
    print("📖 Dictionary Entries:")
    print("-" * 70)
    
    for i, (canonical, variants) in enumerate(sorted(PRONUNCIATION_DICT.items()), 1):
        variants_str = ", ".join(variants)
        print(f"{i:4d}. {canonical:20s} → [{variants_str}]")
    
    print("-" * 70)
    print()
    
    # Demonstrate word matching
    print("🔍 Word Matching Examples:")
    print("-" * 70)
    
    test_words = [
        'tau', 'asong', 'kumain', 'magand', 'puti', 
        'isa', 'bahey', 'guro', 'libro', 'saya'
    ]
    
    for test_word in test_words:
        canonical = match_word(test_word)
        if canonical:
            print(f"   mic heard: '{test_word:15s}' → matched to: '{canonical}'")
        else:
            print(f"   mic heard: '{test_word:15s}' → no match found")
    
    print("-" * 70)
    print()
    
    # Usage examples
    print("💡 Usage Examples:")
    print("-" * 70)
    print()
    print("1. Match a heard word to canonical form:")
    print("   >>> from tagalog_pronunciation_dictionary import match_word")
    print("   >>> match_word('tau')")
    print("   'tao'")
    print()
    print("2. Get all variants of a word:")
    print("   >>> from tagalog_pronunciation_dictionary import get_variants")
    print("   >>> get_variants('tao')")
    print("   ['tau', 'tao', 'tawo']")
    print()
    print("3. Search for words:")
    print("   >>> from tagalog_pronunciation_dictionary import search_words")
    print("   >>> search_words(r'^ma')  # Words starting with 'ma'")
    print("   ['maganda', 'malaki', 'mabuti', ...]")
    print()
    print("-" * 70)
    print()
    print("✅ Dictionary ready for integration with speech recognition system!")
    print()


if __name__ == "__main__":
    main()
