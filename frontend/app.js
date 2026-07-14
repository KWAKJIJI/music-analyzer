const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";
const DEFAULT_RENDER_API_BASE_URL = "https://music-analyzer-backend-ka44.onrender.com";
const API_BASE_URL =
  window.MUSIC_ANALYZER_API_BASE_URL ||
  localStorage.getItem("musicAnalyzerApiBaseUrl") ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? DEFAULT_LOCAL_API_BASE_URL
    : DEFAULT_RENDER_API_BASE_URL);
const ANALYZE_URL = `${API_BASE_URL}/analyze`;
const COMPARE_URL = `${API_BASE_URL}/compare`;
const NOTE_LABELS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const tabButtons = document.querySelectorAll(".tab-button");
const modePanels = document.querySelectorAll(".mode-panel");

const fileInput = document.getElementById("fileInput");
const analyzeButton = document.getElementById("analyzeButton");
const statusMessage = document.getElementById("statusMessage");
const audioPlayer = document.getElementById("audioPlayer");

const summaryBpm = document.getElementById("summaryBpm");
const summaryBeats = document.getElementById("summaryBeats");
const summaryOnsets = document.getElementById("summaryOnsets");

const compareFileA = document.getElementById("compareFileA");
const compareFileB = document.getElementById("compareFileB");
const compareButton = document.getElementById("compareButton");
const compareStatusMessage = document.getElementById("compareStatusMessage");
const compareAudioA = document.getElementById("compareAudioA");
const compareAudioB = document.getElementById("compareAudioB");

const overallScore = document.getElementById("overallScore");
const melodyScore = document.getElementById("melodyScore");
const harmonyScore = document.getElementById("harmonyScore");
const rhythmScore = document.getElementById("rhythmScore");
const comparisonSummary = document.getElementById("comparisonSummary");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  clearStatus(statusMessage);

  if (!file) {
    audioPlayer.removeAttribute("src");
    return;
  }

  audioPlayer.src = URL.createObjectURL(file);
});

compareFileA.addEventListener("change", () => updateCompareAudio(compareFileA, compareAudioA));
compareFileB.addEventListener("change", () => updateCompareAudio(compareFileB, compareAudioB));

analyzeButton.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    showError(statusMessage, "분석할 음악 파일을 먼저 선택해 주세요.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  setButtonLoading(analyzeButton, true, "분석 중...", "분석 시작");
  showStatus(statusMessage, "음악을 분석하고 있습니다. 파일 길이에 따라 시간이 걸릴 수 있습니다.");

  try {
    const payload = await postForm(ANALYZE_URL, formData);
    renderSingleResults(payload);
    showStatus(statusMessage, "분석이 완료되었습니다.");
  } catch (error) {
    showError(statusMessage, error.message || "알 수 없는 오류가 발생했습니다.");
  } finally {
    setButtonLoading(analyzeButton, false, "분석 중...", "분석 시작");
  }
});

compareButton.addEventListener("click", async () => {
  const fileA = compareFileA.files[0];
  const fileB = compareFileB.files[0];

  if (!fileA || !fileB) {
    showError(compareStatusMessage, "비교할 음악 파일 두 개를 모두 선택해 주세요.");
    return;
  }

  const formData = new FormData();
  formData.append("file_a", fileA);
  formData.append("file_b", fileB);

  setButtonLoading(compareButton, true, "비교 분석 중...", "비교 분석 시작");
  showStatus(compareStatusMessage, "두 곡을 분석하고 유사도를 계산하고 있습니다.");

  try {
    const payload = await postForm(COMPARE_URL, formData);
    renderComparisonResults(payload);
    showStatus(compareStatusMessage, "비교 분석이 완료되었습니다.");
  } catch (error) {
    showError(compareStatusMessage, error.message || "비교 분석 중 오류가 발생했습니다.");
  } finally {
    setButtonLoading(compareButton, false, "비교 분석 중...", "비교 분석 시작");
  }
});

function switchMode(mode) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  modePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${mode}Mode`);
  });
}

function updateCompareAudio(input, player) {
  clearStatus(compareStatusMessage);
  const file = input.files[0];

  if (!file) {
    player.removeAttribute("src");
    return;
  }

  player.src = URL.createObjectURL(file);
}

async function postForm(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || "요청에 실패했습니다.");
  }

  return payload;
}

function setButtonLoading(button, isLoading, loadingText, defaultText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
}

function showStatus(target, message) {
  target.textContent = message;
  target.classList.remove("error");
}

function showError(target, message) {
  target.textContent = message;
  target.classList.add("error");
}

function clearStatus(target) {
  target.textContent = "";
  target.classList.remove("error");
}

function renderSingleResults(data) {
  renderWaveform("waveformChart", data.waveform);
  renderMelody("melodyChart", data.melody);
  renderHarmony("harmonyChart", data.harmony);
  renderRhythm("rhythmChart", data.rhythm);
  renderSummary(data.rhythm);
}

function renderComparisonResults(data) {
  overallScore.textContent = formatScore(data.overall_similarity);
  melodyScore.textContent = formatScore(data.melody_similarity);
  harmonyScore.textContent = formatScore(data.harmony_similarity);
  rhythmScore.textContent = formatScore(data.rhythm_similarity);

  renderComparisonSummary(data.summary);
  renderCompareWaveform(data.song_a.waveform, data.song_b.waveform);
  renderWaveform("compareWaveformAChart", data.song_a.waveform);
  renderWaveform("compareWaveformBChart", data.song_b.waveform);
  renderCompareMelody(data.song_a.melody, data.song_b.melody);
  renderMelody("compareMelodyAChart", data.song_a.melody);
  renderMelody("compareMelodyBChart", data.song_b.melody);
  renderHarmony("compareHarmonyAChart", data.song_a.harmony);
  renderHarmony("compareHarmonyBChart", data.song_b.harmony);
  renderCompareRhythm(data.song_a.rhythm, data.song_b.rhythm);
  renderRhythm("compareRhythmAChart", data.song_a.rhythm);
  renderRhythm("compareRhythmBChart", data.song_b.rhythm);
}

function renderWaveform(chartId, waveform) {
  Plotly.newPlot(
    chartId,
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

function renderMelody(chartId, melody) {
  Plotly.newPlot(
    chartId,
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

function renderCompareWaveform(waveformA, waveformB) {
  Plotly.newPlot(
    "compareWaveformChart",
    [
      {
        x: waveformA.times,
        y: waveformA.amplitudes,
        type: "scatter",
        mode: "lines",
        line: { color: "#1876d1", width: 1 },
        name: "곡 A",
      },
      {
        x: waveformB.times,
        y: waveformB.amplitudes,
        type: "scatter",
        mode: "lines",
        line: { color: "#d1495b", width: 1 },
        name: "곡 B",
      },
    ],
    baseLayout("시간 (초)", "진폭"),
    { responsive: true }
  );
}

function renderCompareMelody(melodyA, melodyB) {
  Plotly.newPlot(
    "compareMelodyChart",
    [
      {
        x: melodyA.times,
        y: melodyA.pitches,
        type: "scatter",
        mode: "lines",
        connectgaps: false,
        line: { color: "#1876d1", width: 2 },
        name: "곡 A",
      },
      {
        x: melodyB.times,
        y: melodyB.pitches,
        type: "scatter",
        mode: "lines",
        connectgaps: false,
        line: { color: "#d1495b", width: 2 },
        name: "곡 B",
      },
    ],
    baseLayout("시간 (초)", "Pitch (Hz)"),
    { responsive: true }
  );
}

function renderHarmony(chartId, harmony) {
  Plotly.newPlot(
    chartId,
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

function renderRhythm(chartId, rhythm) {
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
    chartId,
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

function renderCompareRhythm(rhythmA, rhythmB) {
  Plotly.newPlot(
    "compareRhythmChart",
    [
      {
        x: rhythmA.onset_times,
        y: rhythmA.onset_strength,
        type: "scatter",
        mode: "lines",
        line: { color: "#1876d1", width: 2 },
        name: "곡 A onset",
      },
      {
        x: rhythmB.onset_times,
        y: rhythmB.onset_strength,
        type: "scatter",
        mode: "lines",
        line: { color: "#d1495b", width: 2 },
        name: "곡 B onset",
      },
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

function renderComparisonSummary(summary) {
  const items = [
    summary.overall,
    summary.melody,
    summary.harmony,
    summary.rhythm,
    summary.disclaimer,
  ];

  comparisonSummary.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function formatScore(score) {
  return `${Number(score).toFixed(1)}%`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
