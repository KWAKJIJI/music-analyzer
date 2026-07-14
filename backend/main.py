from pathlib import Path
from uuid import uuid4
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from analyzer import analyze_audio


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def get_allowed_origins() -> list[str]:
    extra_origins = os.getenv("ALLOWED_ORIGINS", "")
    origins = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
    ]

    origins.extend(
        origin.strip()
        for origin in extra_origins.split(",")
        if origin.strip()
    )
    return origins

app = FastAPI(
    title="Free Music Analyzer API",
    description="Extracts simple waveform, melody, harmony, and rhythm features from uploaded audio.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Music Analyzer API is running."}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please upload an audio file.")

    extension = Path(file.filename).suffix.lower()
    if extension not in {".mp3", ".wav", ".m4a", ".flac", ".ogg"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload MP3, WAV, M4A, FLAC, or OGG.",
        )

    temp_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File is too large. Please upload a file under 25 MB.")

        temp_path.write_bytes(content)
        return analyze_audio(temp_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {exc}") from exc
    finally:
        if temp_path.exists():
            temp_path.unlink()
