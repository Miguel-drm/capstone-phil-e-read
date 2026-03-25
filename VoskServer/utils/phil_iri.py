"""
Phil-IRI miscue detection engine.

This module provides a focused, easy-to-integrate utility class for comparing
the target story text against a student's transcript and producing Phil-IRI
miscue categories, counts, and reading accuracy.
"""

from __future__ import annotations

import difflib
import re
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple


@dataclass(frozen=True)
class Annotation:
    target_word: str
    student_word: str
    label: str
    emoji: str
    is_error: bool
    is_phonetic_similar: bool = False

    def as_dict(self) -> Dict[str, object]:
        return {
            "target_word": self.target_word,
            "student_word": self.student_word,
            "label": self.label,
            "emoji": self.emoji,
            "is_error": self.is_error,
            "is_phonetic_similar": self.is_phonetic_similar,
        }


class PhilIRIEngine:
    DEFAULT_EMOJI_MAP: Dict[str, str] = {
        "correct": "✅",
        "omission": "⏭️",
        "insertion": "➕",
        "substitution": "🔄",
        "mispronunciation": "🔤",
        "reversal": "↩️",
        "transposition": "🔀",
        "self_correct": "✏️",
    }

    # Per your requirement, only these are subtracted from word-accuracy:
    # omission, substitution (incl. mispronunciation), and reversal.
    ERROR_TYPES_FOR_SCORING: Set[str] = {"omission", "substitution", "reversal"}
    CORRECTION_MARKERS: Set[str] = {
        "pause",
        "correction",
        "sorry",
        "no",
        "wait",
        "oops",
        "um",
        "uh",
        "i",
        "mean",
    }

    def __init__(
        self,
        emoji_map: Optional[Dict[str, str]] = None,
        phonetic_similarity_threshold: float = 0.75,  # Lowered from 0.78 for better Tagalog support
    ) -> None:
        self.emoji_map = dict(self.DEFAULT_EMOJI_MAP)
        if emoji_map:
            self.emoji_map.update(emoji_map)
        self.phonetic_similarity_threshold = phonetic_similarity_threshold

    def analyze(self, target_text: str, student_transcript: str) -> Dict[str, object]:
        target_words = self._normalize_words(target_text)
        transcript_words = self._normalize_words(student_transcript)
        student_words, self_correct_indices = self._apply_self_correction_pattern(
            transcript_words
        )

        matcher = difflib.SequenceMatcher(a=target_words, b=student_words, autojunk=False)
        opcodes = matcher.get_opcodes()
        summary = Counter()
        annotations: List[Annotation] = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                for t_word, s_word, s_idx in zip(
                    target_words[i1:i2], student_words[j1:j2], range(j1, j2)
                ):
                    if s_idx in self_correct_indices:
                        annotations.append(
                            self._make_annotation(t_word, s_word, "self_correct")
                        )
                        summary["self_correct"] += 1
                    else:
                        annotations.append(self._make_annotation(t_word, s_word, "correct"))
                        summary["correct"] += 1
                continue

            if tag == "delete":
                for t_word in target_words[i1:i2]:
                    annotations.append(self._make_annotation(t_word, "", "omission"))
                    summary["omission"] += 1
                continue

            if tag == "insert":
                for s_word, s_idx in zip(student_words[j1:j2], range(j1, j2)):
                    label = "self_correct" if s_idx in self_correct_indices else "insertion"
                    annotations.append(self._make_annotation("", s_word, label))
                    summary[label] += 1
                continue

            # tag == "replace"
            left = target_words[i1:i2]
            right = student_words[j1:j2]

            if self._is_transposition(left, right):
                for t_word, s_word in zip(left, right):
                    annotations.append(self._make_annotation(t_word, s_word, "transposition"))
                    summary["transposition"] += 1
                continue

            max_len = max(len(left), len(right))
            for idx in range(max_len):
                t_word = left[idx] if idx < len(left) else ""
                s_word = right[idx] if idx < len(right) else ""

                if t_word and not s_word:
                    label = "omission"
                elif s_word and not t_word:
                    label = "insertion"
                else:
                    label = self._classify_replace(t_word, s_word)

                annotations.append(self._make_annotation(t_word, s_word, label))
                summary[label] += 1

        total_words = len(target_words)
        total_miscues = self._count_scored_errors(summary)
        accuracy_rate = self._calculate_accuracy(total_words, total_miscues)

        return {
            "annotated_text": [item.as_dict() for item in annotations],
            "miscue_summary": {self.emoji_map[k]: v for k, v in summary.items()},
            "accuracy_rate": accuracy_rate,
            "reading_level": self._reading_level(accuracy_rate),
            "meta": {
                "total_words": total_words,
                "total_miscues_scored": total_miscues,
            },
        }

    def _normalize_words(self, text: str) -> List[str]:
        # Keep contractions while removing punctuation/noise.
        return re.findall(r"[a-z0-9']+", (text or "").lower())

    def _apply_self_correction_pattern(
        self, words: List[str]
    ) -> Tuple[List[str], Set[int]]:
        """
        Detect patterns like:
        - wrong [pause/correction] right
        - wrong sorry right
        - wrong i mean right

        The corrected word is preserved and tagged as self-correct, while the
        earlier wrong attempt is not counted as an error.
        """
        cleaned: List[str] = []
        self_correct_indices: Set[int] = set()
        i = 0

        while i < len(words):
            # Need at least: wrong marker right
            if i + 2 < len(words) and words[i + 1] in self.CORRECTION_MARKERS:
                k = i + 1
                while k < len(words) and words[k] in self.CORRECTION_MARKERS:
                    k += 1
                if k < len(words):
                    corrected_word = words[k]
                    cleaned.append(corrected_word)
                    self_correct_indices.add(len(cleaned) - 1)
                    i = k + 1
                    continue

            cleaned.append(words[i])
            i += 1

        return cleaned, self_correct_indices

    def _classify_replace(self, target_word: str, student_word: str) -> str:
        # Check for reversal first (letters rearranged)
        if sorted(target_word) == sorted(student_word):
            return "reversal"
        
        # Check phonetic similarity for mispronunciation
        if self._is_phonetically_similar(target_word, student_word):
            return "mispronunciation"
        
        # Default to substitution for completely different words
        return "substitution"

    def _is_transposition(self, left: List[str], right: List[str]) -> bool:
        return len(left) == len(right) and len(left) > 1 and sorted(left) == sorted(right)

    def _is_phonetically_similar(self, a: str, b: str) -> bool:
        ratio = difflib.SequenceMatcher(None, a, b).ratio()
        
        # IMPROVED: More conservative phonetic matching to avoid false positives
        if len(a) <= 2 or len(b) <= 2:
            # For short words, require higher similarity
            return ratio >= 0.70
        
        # For longer words, check multiple factors
        same_start = a and b and a[0] == b[0]
        same_end = a and b and a[-1] == b[-1]
        similar_length = abs(len(a) - len(b)) <= 1  # Stricter length requirement
        
        # Require higher similarity AND structural similarity
        if ratio >= 0.70 and (same_start or same_end) and similar_length:
            return True
        
        # Very high ratio for obvious mispronunciations
        if ratio >= 0.85:
            return True
        
        # Check for specific sound substitutions only
        sound_pairs = [
            ('c', 'k'), ('ph', 'f'), ('th', 't'), ('th', 'd'),
            ('p', 'b'), ('t', 'd'), ('k', 'g'), ('f', 'v'),
            ('s', 'z'), ('r', 'l')
        ]
        
        # Only consider mispronunciation if there's a clear sound substitution AND good similarity
        if ratio >= 0.60:
            for s1, s2 in sound_pairs:
                if (s1 in a and s2 in b) or (s2 in a and s1 in b):
                    return True
            
        return False

    def _make_annotation(self, t_word: str, s_word: str, label: str) -> Annotation:
        scoring_label = "substitution" if label == "mispronunciation" else label
        return Annotation(
            target_word=t_word,
            student_word=s_word,
            label=label,
            emoji=self.emoji_map[label],
            is_error=scoring_label in self.ERROR_TYPES_FOR_SCORING,
            is_phonetic_similar=(label == "mispronunciation"),
        )

    def _count_scored_errors(self, summary: Counter) -> int:
        # Mispronunciation is treated as substitution for scoring.
        substitution_total = summary.get("substitution", 0) + summary.get("mispronunciation", 0)
        return (
            summary.get("omission", 0)
            + substitution_total
            + summary.get("reversal", 0)
        )

    def _calculate_accuracy(self, total_words: int, total_miscues: int) -> float:
        if total_words <= 0:
            return 0.0
        return round(((total_words - total_miscues) / total_words) * 100, 2)

    def _reading_level(self, accuracy_rate: float) -> str:
        if accuracy_rate >= 97:
            return "Independent"
        if accuracy_rate >= 90:
            return "Instructional"
        return "Frustration"


if __name__ == "__main__":
    engine = PhilIRIEngine()
    result = engine.analyze(
        target_text="The cat was on the mat.",
        student_transcript="The cat saw pause correction was on mat",
    )
    print(result)
