from __future__ import annotations

from typing import Any

import librosa
import numpy as np


MELODY_WEIGHT = 0.5
HARMONY_WEIGHT = 0.3
RHYTHM_WEIGHT = 0.2


def compare_analyses(song_a: dict[str, Any], song_b: dict[str, Any]) -> dict[str, Any]:
    melody = _compare_melody(song_a["melody"], song_b["melody"])
    harmony = _compare_harmony(song_a["harmony"], song_b["harmony"])
    rhythm = _compare_rhythm(song_a["rhythm"], song_b["rhythm"])

    overall = (
        melody["score"] * MELODY_WEIGHT
        + harmony["score"] * HARMONY_WEIGHT
        + rhythm["score"] * RHYTHM_WEIGHT
    )

    return {
        "overall_similarity": round(overall, 2),
        "melody_similarity": round(melody["score"], 2),
        "harmony_similarity": round(harmony["score"], 2),
        "rhythm_similarity": round(rhythm["score"], 2),
        "weights": {
            "melody": MELODY_WEIGHT,
            "harmony": HARMONY_WEIGHT,
            "rhythm": RHYTHM_WEIGHT,
        },
        "summary": {
            "overall": _describe_score(overall, "두 곡의 전체 음악적 특징"),
            "melody": _describe_score(melody["score"], "멜로디 윤곽"),
            "harmony": _describe_score(harmony["score"], "화성/chroma 특징"),
            "rhythm": _describe_score(rhythm["score"], "리듬 특징"),
            "disclaimer": "이 점수는 오디오 특징 기반 참고 지표이며 법적 표절 여부를 판정하지 않습니다.",
        },
        "details": {
            "melody": melody,
            "harmony": harmony,
            "rhythm": rhythm,
        },
        "song_a": song_a,
        "song_b": song_b,
    }


def _compare_melody(melody_a: dict[str, Any], melody_b: dict[str, Any]) -> dict[str, Any]:
    contour_a = _pitch_to_centered_midi(melody_a["pitches"])
    contour_b = _pitch_to_centered_midi(melody_b["pitches"])

    if len(contour_a) < 4 or len(contour_b) < 4:
        return {
            "score": 0.0,
            "method": "centered MIDI pitch contour + DTW",
            "reason": "Not enough voiced pitch data to compare melodies.",
        }

    distance, _ = librosa.sequence.dtw(
        X=contour_a.reshape(1, -1),
        Y=contour_b.reshape(1, -1),
        metric="euclidean",
    )
    normalized_distance = float(distance[-1, -1] / max(len(contour_a), len(contour_b)))
    score = _distance_to_score(normalized_distance, scale=6.0)

    return {
        "score": score,
        "method": "centered MIDI pitch contour + DTW",
        "normalized_distance": round(normalized_distance, 4),
        "compared_points_a": int(len(contour_a)),
        "compared_points_b": int(len(contour_b)),
    }


def _compare_harmony(harmony_a: dict[str, Any], harmony_b: dict[str, Any]) -> dict[str, Any]:
    chroma_a = np.asarray(harmony_a["chroma"], dtype=float)
    chroma_b = np.asarray(harmony_b["chroma"], dtype=float)

    if chroma_a.size == 0 or chroma_b.size == 0:
        return {
            "score": 0.0,
            "method": "key-shifted chroma cosine similarity",
            "reason": "Not enough chroma data to compare harmony.",
        }

    profile_a = _normalize_vector(np.mean(chroma_a, axis=1))
    profile_b = _normalize_vector(np.mean(chroma_b, axis=1))

    best_score = 0.0
    best_shift = 0
    for shift in range(12):
        shifted = np.roll(profile_b, shift)
        score = _cosine_similarity(profile_a, shifted) * 100
        if score > best_score:
            best_score = score
            best_shift = shift

    return {
        "score": round(best_score, 4),
        "method": "key-shifted chroma cosine similarity",
        "best_key_shift_semitones": int(best_shift),
    }


def _compare_rhythm(rhythm_a: dict[str, Any], rhythm_b: dict[str, Any]) -> dict[str, Any]:
    tempo_a = float(rhythm_a.get("tempo") or 0)
    tempo_b = float(rhythm_b.get("tempo") or 0)
    onset_a = np.asarray(rhythm_a["onset_strength"], dtype=float)
    onset_b = np.asarray(rhythm_b["onset_strength"], dtype=float)

    tempo_score = _tempo_similarity(tempo_a, tempo_b)
    onset_score = _resampled_cosine_score(onset_a, onset_b)
    score = tempo_score * 0.4 + onset_score * 0.6

    return {
        "score": round(score, 4),
        "method": "tempo similarity + resampled onset envelope cosine similarity",
        "tempo_similarity": round(tempo_score, 4),
        "onset_pattern_similarity": round(onset_score, 4),
        "tempo_a": round(tempo_a, 2),
        "tempo_b": round(tempo_b, 2),
    }


def _pitch_to_centered_midi(pitches: list[float | None]) -> np.ndarray:
    values = np.asarray([pitch if pitch else np.nan for pitch in pitches], dtype=float)
    values = values[np.isfinite(values) & (values > 0)]
    if values.size == 0:
        return np.asarray([], dtype=float)

    midi = librosa.hz_to_midi(values)
    midi = midi[np.isfinite(midi)]
    if midi.size == 0:
        return np.asarray([], dtype=float)

    centered = midi - np.nanmedian(midi)
    return _resample_array(centered, target_length=min(max(len(centered), 64), 256))


def _resampled_cosine_score(values_a: np.ndarray, values_b: np.ndarray) -> float:
    if values_a.size < 2 or values_b.size < 2:
        return 0.0

    a = _normalize_vector(_resample_array(values_a, 256))
    b = _normalize_vector(_resample_array(values_b, 256))
    return _cosine_similarity(a, b) * 100


def _tempo_similarity(tempo_a: float, tempo_b: float) -> float:
    if tempo_a <= 0 or tempo_b <= 0:
        return 0.0

    ratio = min(tempo_a, tempo_b) / max(tempo_a, tempo_b)
    return max(0.0, min(100.0, ratio * 100))


def _resample_array(values: np.ndarray, target_length: int) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if values.size == 0:
        return np.asarray([], dtype=float)
    if values.size == target_length:
        return values

    source_x = np.linspace(0, 1, values.size)
    target_x = np.linspace(0, 1, target_length)
    return np.interp(target_x, source_x, values)


def _normalize_vector(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    values = np.nan_to_num(values)
    values = values - np.mean(values)
    norm = np.linalg.norm(values)
    if norm == 0:
        return values
    return values / norm


def _cosine_similarity(values_a: np.ndarray, values_b: np.ndarray) -> float:
    norm_a = np.linalg.norm(values_a)
    norm_b = np.linalg.norm(values_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = float(np.dot(values_a, values_b) / (norm_a * norm_b))
    return max(0.0, min(1.0, similarity))


def _distance_to_score(distance: float, scale: float) -> float:
    score = 100 * np.exp(-distance / scale)
    return max(0.0, min(100.0, float(score)))


def _describe_score(score: float, label: str) -> str:
    if score >= 80:
        return f"{label}이 매우 유사합니다."
    if score >= 60:
        return f"{label}이 꽤 유사합니다."
    if score >= 40:
        return f"{label}이 일부 유사합니다."
    return f"{label}의 유사도가 낮은 편입니다."
