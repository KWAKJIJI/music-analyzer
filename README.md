# 무료 음악 분석기

음악 파일을 업로드하면 librosa로 기본 음악 특징을 추출하고 Plotly.js 그래프로 시각화하는 MVP 프로젝트입니다.

초기 버전은 무거운 AI 모델 없이 무료 오픈소스 라이브러리만 사용합니다. 분석은 기본적으로 처음 60초만 처리합니다.

## 폴더 구조

```text
music-analyzer/
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  └─ app.js
│
├─ backend/
│  ├─ main.py
│  ├─ analyzer.py
│  ├─ requirements.txt
│  └─ uploads/
│
└─ README.md
```

## Backend 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API 서버는 기본적으로 아래 주소에서 실행됩니다.

```text
http://localhost:8000
```

### API

```http
POST /analyze
```

`multipart/form-data`로 `file` 필드에 MP3 또는 WAV 파일을 업로드합니다. M4A, FLAC, OGG도 기본적으로 허용합니다.

응답 예시:

```json
{
  "waveform": {
    "times": [],
    "amplitudes": []
  },
  "melody": {
    "times": [],
    "pitches": [],
    "confidence": []
  },
  "harmony": {
    "times": [],
    "chroma": []
  },
  "rhythm": {
    "tempo": 120,
    "beats": [],
    "onsets": [],
    "onset_times": [],
    "onset_strength": []
  }
}
```

## Frontend 실행

VS Code Live Server를 사용하거나 아래처럼 Python 정적 서버를 실행합니다.

```bash
cd frontend
python -m http.server 5500
```

브라우저에서 접속합니다.

```text
http://localhost:5500
```

## Render 배포

다른 공간에 있는 사용자도 접속하게 하려면 GitHub에 이 프로젝트를 올린 뒤 Render에서 배포합니다.

### 1. GitHub에 업로드

GitHub에서 `music-analyzer` 저장소를 만든 뒤 로컬 프로젝트 폴더에서 실행합니다.

```bash
git init
git add .
git commit -m "Initial music analyzer MVP"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_ID/music-analyzer.git
git push -u origin main
```

`YOUR_GITHUB_ID`는 본인 GitHub 아이디로 바꿉니다.

### 2. Render Blueprint로 배포

프로젝트 루트의 `render.yaml`을 사용하면 백엔드와 프론트엔드를 함께 만들 수 있습니다.

1. Render에 GitHub 계정으로 로그인합니다.
2. `New +`를 누릅니다.
3. `Blueprint`를 선택합니다.
4. GitHub 저장소 `music-analyzer`를 연결합니다.
5. Render가 `render.yaml`을 감지하면 적용합니다.

생성되는 서비스 이름은 기본적으로 다음과 같습니다.

```text
music-analyzer-backend
music-analyzer-frontend
```

백엔드 주소 예시:

```text
https://music-analyzer-backend.onrender.com
```

프론트엔드 주소 예시:

```text
https://music-analyzer-frontend.onrender.com
```

프론트엔드가 다른 이름으로 배포되면 Render 백엔드의 `ALLOWED_ORIGINS` 환경 변수에 실제 프론트엔드 주소를 넣어야 합니다.

프론트엔드가 백엔드를 찾지 못하면 `frontend/app.js`의 `DEFAULT_RENDER_API_URL`을 실제 백엔드 주소로 수정한 뒤 다시 commit/push 합니다.

## CORS

개발 중에는 다음 주소에서 백엔드 API 호출을 허용합니다.

```text
http://localhost:5500
http://127.0.0.1:5500
http://localhost:3000
```

Render 배포 시에는 `ALLOWED_ORIGINS` 환경 변수와 `https://*.onrender.com` 주소를 허용합니다.

## 분석 기능

- 파형: librosa로 오디오를 로드한 뒤 그래프 표시용으로 다운샘플링합니다.
- 멜로디: `librosa.pyin`으로 pitch contour와 confidence를 추출합니다.
- 화성: `librosa.feature.chroma_cqt`로 12음계 chromagram을 추출합니다.
- 리듬: onset strength, onset 위치, BPM, beat 위치를 추출합니다.

## 사용 흐름

1. 사용자가 MP3 또는 WAV 파일을 업로드합니다.
2. 분석 시작 버튼을 누릅니다.
3. 백엔드가 음악을 분석합니다.
4. 프론트엔드가 분석 결과를 받습니다.
5. 원본 파형, 멜로디 그래프, 화성 그래프, 리듬 그래프를 화면에 표시합니다.
6. BPM, beat 개수, onset 개수를 요약해서 보여줍니다.

## 나중에 추가할 수 있는 기능

- 두 곡 비교 기능
- 멜로디 유사도 계산
- 화성 유사도 계산
- 리듬 유사도 계산
- 최종 음악 일치율 계산
- Basic Pitch 기반 piano roll
- Demucs 기반 보컬/반주/드럼 분리
- 코드 진행 자동 추정
- 분석 신뢰도 표시
