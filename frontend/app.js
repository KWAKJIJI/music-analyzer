const DEFAULT_LOCAL_API_URL = "http://localhost:8000/analyze";
const DEFAULT_RENDER_API_URL = "https://music-analyzer-backend.onrender.com/analyze";
const API_URL =
  window.MUSIC_ANALYZER_API_URL ||
  localStorage.getItem("musicAnalyzerApiUrl") ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? DEFAULT_LOCAL_API_URL
    : DEFAULT_RENDER_API_URL);
const NOTE_LABELS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const fileInput = document.getElementById("fileInput");
const analyzeButton = document.getElementById("analyzeButton");
const statusMessage = document.getElementById("statusMessage");
const audioPlayer = document.getElementById("audioPlayer");

const summaryBpm = document.getElementById("summaryBpm");
const summaryBeats = document.getElementById("summaryBeats");
const summaryOnsets = document.getElementById("summaryOnsets");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  clearStatus();

  if (!file) {
    audioPlayer.removeAttribute("src");
    return;
  }

  audioPlayer.src = URL.createObjectURL(file);
});

analyzeButton.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    showError("분석할 음악 파일을 먼저 선택해 주세요.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  setLoading(true);
  showStatus("음악을 분석하고 있습니다. 파일 길이에 따라 시간이 걸릴 수 있습니다.");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || "분석 요청에 실패했습니다.");
    }

    renderResults(payload);
    showStatus("분석이 완료되었습니다.");
  } catch (error) {
    showError(error.message || "알 수 없는 오류가 발생했습니다.");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "분석 중..." : "분석 시작";
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("error");
}

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("error");
}

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.classList.remove("error");
}

function renderResults(data) {
  renderWaveform(data.waveform);
  renderMelody(data.melody);
  renderHarmony(data.harmony);
  renderRhythm(data.rhythm);
  renderSummary(data.rhythm);
}

function renderWaveform(waveform) {
  Plotly.newPlot(
    "waveformChart",
    [
      {
        x: waveform.times,
        y: waveform.amplitudes,
        type: "scatter",
        mode: "lines",
        line: { color: "#1876d1", width: 1 },
        name: "Waveform",
      },
    ],
    baseLayout("시간 (초)", "진폭"),
    { responsive: true }
  );
}

function renderMelody(melody) {
  Plotly.newPlot(
    "melodyChart",
    [
      {
        x: melody.times,
        y: melody.pitches,
        type: "scatter",
        mode: "lines",
        connectgaps: false,
        line: { color: "#1d8f5f", width: 2 },
        name: "Pitch",
      },
    ],
    baseLayout("시간 (초)", "Pitch (Hz)"),
    { responsive: true }
  );
}

function renderHarmony(harmony) {
  Plotly.newPlot(
    "harmonyChart",
    [
      {
        x: harmony.times,
        y: NOTE_LABELS,
        z: harmony.chroma,
        type: "heatmap",
        colorscale: "Viridis",
        colorbar: { title: "강도" },
      },
    ],
    baseLayout("시간 (초)", "음계"),
    { responsive: true }
  );
}

function renderRhythm(rhythm) {
  const maxStrength = Math.max(...rhythm.onset_strength, 1);
  const beatTrace = {
    x: rhythm.beats,
    y: rhythm.beats.map(() => maxStrength),
    type: "scatter",
    mode: "markers",
    marker: { color: "#d1495b", size: 8, symbol: "line-ns-open" },
    name: "Beats",
  };

  Plotly.newPlot(
    "rhythmChart",
    [
      {
        x: rhythm.onset_times,
        y: rhythm.onset_strength,
        type: "scatter",
        mode: "lines",
        line: { color: "#edae49", width: 2 },
        name: "Onset Strength",
      },
      beatTrace,
    ],
    baseLayout("시간 (초)", "Onset Strength"),
    { responsive: true }
  );
}

function renderSummary(rhythm) {
  summaryBpm.textContent = Number(rhythm.tempo).toFixed(1);
  summaryBeats.textContent = rhythm.beats.length;
  summaryOnsets.textContent = rhythm.onsets.length;
}

function baseLayout(xTitle, yTitle) {
  return {
    margin: { t: 18, r: 22, b: 48, l: 58 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    xaxis: { title: xTitle, zeroline: false },
    yaxis: { title: yTitle, zeroline: false },
    font: {
      family: 'Arial, "Noto Sans KR", sans-serif',
      color: "#18202a",
    },
  };
}
