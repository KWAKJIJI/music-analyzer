from pathlib import Path
from typing import Any

import librosa
import numpy as np


MAX_DURATION_SECONDS = 30
TARGET_SAMPLE_RATE = 22050
WAVEFORM_POINTS = 2500


def _clean_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (float, np.floating)) and not np.isfinite(value):
        return None
    return float(value)


def _to_list(values: np.ndarray) -> list[float | None]:
    return [_clean_float(value) for value in values]


def _downsample_waveform(y: np.ndarray, sr: int) -> dict[str, list[float]]:
    if len(y) <= WAVEFORM_POINTS:
        indices = np.arange(len(y))
    else:
        indices = np.linspace(0, len(y) - 1, WAVEFORM_POINTS, dtype=int)

    samples = y[indices]
    times = indices / sr

    return {
        "times": times.astype(float).tolist(),
        "amplitudes": samples.astype(float).tolist(),
    }


def _analyze_melody(y: np.ndarray, sr: int) -> dict[str, list[float | None]]:
    frame_length = 1024
    hop_length = 512

    f0 = librosa.yin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    threshold = np.percentile(rms, 35)
    confidence = np.clip(rms / (np.max(rms) + 1e-9), 0, 1)
    pitches = np.where(rms >= threshold, f0, np.nan)

    return {
        "times": times.astype(float).tolist(),
        "pitches": _to_list(pitches),
        "confidence": _to_list(confidence),
    }


def _analyze_harmony(y: np.ndarray, sr: int) -> dict[str, list]:
    hop_length = 512
    chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop_length)
    times = librosa.times_like(chroma, sr=sr, hop_length=hop_length)

    return {
        "times": times.astype(float).tolist(),
        "chroma": chroma.astype(float).tolist(),
    }


def _analyze_rhythm(y: np.ndarray, sr: int) -> dict[str, Any]:
    hop_length = 512
    onset_strength = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.times_like(onset_strength, sr=sr, hop_length=hop_length)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_strength,
        sr=sr,
        hop_length=hop_length,
    )
    beat_tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_strength,
        sr=sr,
        hop_length=hop_length,
    )

    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    onsets = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)

    return {
        "tempo": float(np.atleast_1d(beat_tempo)[0]),
        "beats": beats.astype(float).tolist(),
        "onsets": onsets.astype(float).tolist(),
        "onset_times": onset_times.astype(float).tolist(),
        "onset_strength": onset_strength.astype(float).tolist(),
    }


def analyze_audio(file_path: str | Path) -> dict[str, Any]:
    y, sr = librosa.load(
        file_path,
        sr=TARGET_SAMPLE_RATE,
        mono=True,
        duration=MAX_DURATION_SECONDS,
    )

    if y.size == 0:
        raise ValueError("오디오 데이터를 읽을 수 없습니다.")

    return {
        "waveform": _downsample_waveform(y, sr),
        "melody": _analyze_melody(y, sr),
        "harmony": _analyze_harmony(y, sr),
        "rhythm": _analyze_rhythm(y, sr),
    }
