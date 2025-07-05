let mediaRecorder;
let recordedChunks = [];
let transcribedText = "";
let recognizing = false;
let recordingStartTime;
let recordingTimer;
let currentRecordingMode = "screen";
let currentAudioSource = "system";
let recordingHistory = [];
let db;

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const downloadButton = document.getElementById("downloadButton");
const downloadWordButton = document.getElementById("downloadWordButton");
const video = document.getElementById("recordedVideo");
const controlPanel = document.getElementById("controlPanel");
const statusIndicator = document.getElementById("statusIndicator");
const recordingTime = document.getElementById("recordingTime");
const output = document.getElementById("output");
const action = document.getElementById("action");

let audioStream = null;
let systemAudioStream = null;
let microphoneStream = null;
let audioStreamRequested = false;

let recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;

// IndexedDB setup
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProScreenDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create recordings store
      if (!db.objectStoreNames.contains('recordings')) {
        const store = db.createObjectStore('recordings', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    db = await initDB();
    await loadRecordingHistory();
    initializeApp();
    setupEventListeners();
    showControlPanel();
    createRecordingHistorySection();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    showNotification('Failed to initialize storage. Please refresh the page.', 'error');
  }
});

function initializeApp() {
  const languageSelect = document.getElementById("languageSelect");
  recognition.lang = languageSelect.value;

  const audioSource = document.getElementById("audioSource");
  currentAudioSource = audioSource.value;

  currentRecordingMode = "screen";
  updateModeSelection();
}

function setupEventListeners() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentRecordingMode = btn.dataset.mode;
      updateModeSelection();
      updateActionText();
    });
  });

  document.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      currentRecordingMode = card.dataset.mode;
      updateModeSelection();
      updateActionText();
    });
  });

  document.getElementById("audioSource").addEventListener("change", (e) => {
    currentAudioSource = e.target.value;
    updateActionText();
  });

  document.getElementById("languageSelect").addEventListener("change", (e) => {
    recognition.lang = e.target.value;
  });

  startButton.addEventListener("click", startRecording);
  stopButton.addEventListener("click", stopRecording);
  pauseButton.addEventListener("click", pauseRecording);
  resumeButton.addEventListener("click", resumeRecording);
  downloadButton.addEventListener("click", downloadVideo);
  downloadWordButton.addEventListener("click", downloadWord);

  recognition.onresult = handleSpeechResult;
  recognition.onerror = handleSpeechError;
  recognition.onend = handleSpeechEnd;

  const hamburger = document.querySelector(".hamburger");
  const navMenu = document.querySelector(".nav-menu");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      navMenu.classList.toggle("active");
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  const contactForm = document.querySelector(".contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", handleContactSubmit);
  }
}

function updateModeSelection() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === currentRecordingMode);
  });

  document.querySelectorAll(".mode-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.mode === currentRecordingMode);
  });

  const startBtn = document.querySelector(".start-btn span");
  const startIcon = document.querySelector(".start-btn i");

  if (currentRecordingMode === "screen") {
    startBtn.textContent = "Start Screen Recording";
    startIcon.className = "fas fa-desktop";
  } else {
    startBtn.textContent = "Start Voice Recording";
    startIcon.className = "fas fa-microphone";
  }
}

function updateActionText() {
  const modeText =
    currentRecordingMode === "screen" ? "screen recording" : "voice recording";
  const audioText =
    currentAudioSource === "system"
      ? "system audio"
      : currentAudioSource === "microphone"
      ? "microphone"
      : "system audio + microphone";

  action.textContent = `Ready to start ${modeText} with ${audioText}`;
}

async function startRecording() {
  try {
    updateActionText("Initializing recording...");

    audioStreamRequested = false;
    audioStream = null;
    recordedChunks = [];
    transcribedText = "";

    if (currentRecordingMode === "screen") {
      await startScreenRecording();
    } else {
      await startVoiceRecording();
    }

    startRecordingTimer();
    updateRecordingStatus(true);
    updateButtonStates();
  } catch (error) {
    console.error("Failed to start recording:", error);
    updateActionText("Failed to start recording. Please check permissions.");
  }
}

async function startScreenRecording() {
  const displayOptions = {
    video: {
      cursor: "always",
      displaySurface: "monitor",
    },
    audio: currentAudioSource === "system" || currentAudioSource === "both",
  };

  const screenStream = await navigator.mediaDevices.getDisplayMedia(
    displayOptions
  );
  let combinedStream = screenStream;

  if (currentAudioSource === "microphone" || currentAudioSource === "both") {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (currentAudioSource === "both") {
        const audioContext = new AudioContext();
        const screenSource = audioContext.createMediaStreamSource(screenStream);
        const micSource = audioContext.createMediaStreamSource(micStream);
        const destination = audioContext.createMediaStreamDestination();

        screenSource.connect(destination);
        micSource.connect(destination);

        const videoTracks = screenStream.getVideoTracks();
        const audioTracks = destination.stream.getAudioTracks();
        combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
      } else {
        const videoTracks = screenStream.getVideoTracks();
        const audioTracks = micStream.getAudioTracks();
        combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
      }
    } catch (error) {
      console.log("Microphone not available, using screen audio only:", error);
    }
  }

  setupMediaRecorder(combinedStream);
  startSpeechRecognition();
}

async function startVoiceRecording() {
  try {
    const audioStream = await getAudioStream();
    if (!audioStream || audioStream.getTracks().length === 0) {
      throw new Error("No audio stream available");
    }

    setupMediaRecorder(audioStream);
    startSpeechRecognition();
  } catch (error) {
    console.error("Voice recording failed:", error);
    throw new Error(
      "Failed to access microphone. Please check permissions and try again."
    );
  }
}

async function getAudioStream() {
  if (audioStreamRequested && audioStream) {
    return audioStream;
  }

  audioStreamRequested = true;

  try {
    if (currentAudioSource === "system") {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true,
        });
        audioStream = screenStream;
      } catch (error) {
        console.log("System audio not available, falling back to microphone");
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    } else if (currentAudioSource === "microphone") {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } else if (currentAudioSource === "both") {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true,
        });

        const audioContext = new AudioContext();
        const micSource = audioContext.createMediaStreamSource(micStream);
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        const destination = audioContext.createMediaStreamDestination();

        micSource.connect(destination);
        systemSource.connect(destination);

        audioStream = destination.stream;
      } catch (error) {
        console.log(
          "Both audio sources not available, falling back to microphone"
        );
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    }

    return audioStream;
  } catch (err) {
    console.log("Audio access failed:", err);
    audioStreamRequested = false;
    audioStream = null;
    return null;
  }
}

function setupMediaRecorder(stream) {
  const options = {
    mimeType: "video/webm;codecs=vp9,opus",
    videoBitsPerSecond: 2500000,
  };

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    console.log("MediaRecorder not supported, trying default options");
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = function (event) {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = function () {
    const blob = new Blob(recordedChunks, {
      type: currentRecordingMode === "screen" ? "video/webm" : "audio/webm",
    });
    
    if (currentRecordingMode === "screen") {
      const url = URL.createObjectURL(blob);
      video.src = url;
      video.controls = true;
      video.style.display = "block";
    }
    
    downloadButton.disabled = false;
    downloadWordButton.disabled = false;
    
    saveToHistory(blob);
    
    updateActionText("Recording completed! You can now download your file.");
  };

  mediaRecorder.start();
}

function startSpeechRecognition() {
  try {
    recognition.start();
    recognizing = true;
  } catch (error) {
    console.log("Speech recognition failed to start:", error);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (recognizing) {
    recognition.stop();
    recognizing = false;
  }

  stopRecordingTimer();
  updateRecordingStatus(false);
  updateButtonStates();

  if (mediaRecorder && mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }

  updateActionText("Recording stopped. Processing...");
}

function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    if (recognizing) {
      recognition.stop();
    }
    updateButtonStates();
    updateActionText("Recording paused");
  }
}

function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    if (!recognizing) {
      startSpeechRecognition();
    }
    updateButtonStates();
    updateActionText("Recording resumed");
  }
}

function updateButtonStates() {
  const isRecording = mediaRecorder && mediaRecorder.state === "recording";
  const isPaused = mediaRecorder && mediaRecorder.state === "paused";

  startButton.disabled = isRecording || isPaused;
  stopButton.disabled = !isRecording && !isPaused;
  pauseButton.disabled = !isRecording;
  resumeButton.disabled = !isPaused;
}

function updateRecordingStatus(isRecording) {
  if (isRecording) {
    statusIndicator.classList.add("recording");
    statusIndicator.querySelector(".pulse").style.display = "block";
  } else {
    statusIndicator.classList.remove("recording");
    statusIndicator.querySelector(".pulse").style.display = "none";
  }
}

function startRecordingTimer() {
  recordingStartTime = Date.now();
  recordingTimer = setInterval(updateRecordingTime, 1000);
}

function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
}

function updateRecordingTime() {
  const elapsed = Date.now() - recordingStartTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  recordingTime.textContent = `${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function handleSpeechResult(event) {
  let interim_transcript = "";

  for (let i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      transcribedText += event.results[i][0].transcript + " ";
    } else {
      interim_transcript += event.results[i][0].transcript;
    }
  }

  output.innerHTML =
    transcribedText +
    '<br><em style="color: #6b7280;">' +
    interim_transcript +
    "</em>";
}

function handleSpeechError(event) {
  console.log("Speech recognition error:", event.error);
  if (event.error === "no-speech") {
    setTimeout(() => {
      if (recognizing) {
        recognition.start();
      }
    }, 1000);
  }
}

function handleSpeechEnd() {
  if (recognizing) {
    setTimeout(() => {
      if (recognizing) {
        recognition.start();
      }
    }, 1000);
  }
}

function downloadVideo() {
  const blob = new Blob(recordedChunks, {
    type: currentRecordingMode === "screen" ? "video/webm" : "audio/webm",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download =
    currentRecordingMode === "screen"
      ? "screen-recording.webm"
      : "voice-recording.webm";
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function downloadWord() {
  const content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transcription</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-bottom: 20px; }
        .transcription { background: #f8fafc; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Recording Transcription</h1>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
        <p><strong>Mode:</strong> ${
          currentRecordingMode === "screen"
            ? "Screen Recording"
            : "Voice Recording"
        }</p>
    </div>
    <div class="transcription">
        <h2>Transcribed Text:</h2>
        <p>${transcribedText || "No transcription available"}</p>
    </div>
</body>
</html>`;

  const blob = new Blob([content], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "transcription.doc";
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function handleContactSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const name = e.target.querySelector('input[type="text"]').value;
  const email = e.target.querySelector('input[type="email"]').value;
  const message = e.target.querySelector("textarea").value;

  console.log("Contact form submitted:", { name, email, message });

  const submitBtn = e.target.querySelector(".submit-btn");
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-check"></i> Message Sent!';
  submitBtn.style.background = "#10b981";

  e.target.reset();

  setTimeout(() => {
    submitBtn.innerHTML = originalText;
    submitBtn.style.background = "";
  }, 3000);
}

function showControlPanel() {
  controlPanel.classList.add("show");
}

const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("aos-animate");
    }
  });
}, observerOptions);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-aos]").forEach((el) => {
    observer.observe(el);
  });
});

function createRecordingHistorySection() {
  const recordingOutput = document.getElementById("recordingOutput");
  const historySection = document.createElement("section");
  historySection.id = "recording-history";
  historySection.className = "recording-history";

  historySection.innerHTML = `
        <div class="container">
            <h2>Recording History</h2>
            <div class="history-grid" id="historyGrid">
                <div class="no-recordings">
                    <i class="fas fa-history"></i>
                    <p>No recordings yet. Start recording to see your history here!</p>
                </div>
            </div>
        </div>
    `;

  recordingOutput.parentNode.insertBefore(
    historySection,
    recordingOutput.nextSibling
  );
}

async function saveToHistory(blob) {
  const recording = {
    id: Date.now(),
    name: `${currentRecordingMode === "screen" ? "Screen" : "Voice"} Recording`,
    type: currentRecordingMode === "screen" ? "video" : "audio",
    size: formatFileSize(blob.size),
    duration: recordingTime.textContent,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    transcription: transcribedText,
    blob: blob,
    mimeType: blob.type
  };
  
  try {
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    await store.add(recording);
    
    recordingHistory.unshift(recording);
    
    if (recordingHistory.length > 20) {
      const oldestRecording = recordingHistory.pop();
      await store.delete(oldestRecording.id);
    }
    
    loadRecordingHistory();
    showNotification('Recording saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save recording:', error);
    showNotification('Failed to save recording.', 'error');
  }
}

async function loadRecordingHistory() {
  try {
    const transaction = db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const index = store.index('date');
    
    const request = index.getAll();
    
    request.onsuccess = () => {
      recordingHistory = request.result.sort((a, b) => b.id - a.id);
      displayRecordingHistory();
    };
    
    request.onerror = () => {
      console.error('Failed to load recordings:', request.error);
      showNotification('Failed to load recordings.', 'error');
    };
  } catch (error) {
    console.error('Failed to load recordings:', error);
    showNotification('Failed to load recordings.', 'error');
  }
}

function displayRecordingHistory() {
  const historyGrid = document.getElementById("historyGrid");
  
  if (!historyGrid) return;
  
  if (recordingHistory.length === 0) {
    historyGrid.innerHTML = `
      <div class="no-recordings">
        <i class="fas fa-history"></i>
        <p>No recordings yet. Start recording to see your history here!</p>
      </div>
    `;
    return;
  }
  
  historyGrid.innerHTML = recordingHistory
    .map(
      (recording) => `
        <div class="history-item" data-id="${recording.id}">
          <div class="history-item-header">
            <div class="history-item-icon">
              <i class="fas fa-${
                recording.type === "video" ? "video" : "microphone"
              }"></i>
            </div>
            <div class="history-item-info">
              <h3>${recording.name}</h3>
              <p>${recording.date} at ${recording.time}</p>
              <p>Duration: ${recording.duration} | Size: ${
        recording.size
      }</p>
            </div>
          </div>
          <div class="history-item-actions">
            <button class="history-btn play-btn" onclick="playRecording(${
              recording.id
            })">
              <i class="fas fa-play"></i> Play
            </button>
            <button class="history-btn download-btn" onclick="downloadFromHistory(${
              recording.id
            })">
              <i class="fas fa-download"></i> Download
            </button>
            <button class="history-btn delete-btn" onclick="deleteFromHistory(${
              recording.id
            })">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
          ${
            recording.transcription
              ? `
            <div class="history-item-transcription">
              <h4>Transcription:</h4>
              <p>${recording.transcription.substring(0, 100)}${
                recording.transcription.length > 100 ? "..." : ""
              }</p>
            </div>
          `
              : ""
          }
        </div>
      `
    )
    .join("");
}

async function playRecording(id) {
  try {
    const transaction = db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const recording = request.result;
      if (recording && recording.blob) {
        const video = document.getElementById("recordedVideo");
        const url = URL.createObjectURL(recording.blob);
        
        video.src = url;
        video.controls = true;
        video.style.display = "block";
        video.scrollIntoView({ behavior: "smooth" });
        
        video.onended = () => {
          URL.revokeObjectURL(url);
        };
      }
    };
  } catch (error) {
    console.error('Failed to play recording:', error);
    showNotification('Failed to play recording.', 'error');
  }
}

async function downloadFromHistory(id) {
  try {
    const transaction = db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const recording = request.result;
      if (recording && recording.blob) {
        const url = URL.createObjectURL(recording.blob);
        
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = `${recording.name}-${recording.date}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    };
  } catch (error) {
    console.error('Failed to download recording:', error);
    showNotification('Failed to download recording.', 'error');
  }
}

async function deleteFromHistory(id) {
  try {
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    await store.delete(id);
    
    recordingHistory = recordingHistory.filter((r) => r.id !== id);
    displayRecordingHistory();
    showNotification("Recording deleted successfully.", "success");
  } catch (error) {
    console.error('Failed to delete recording:', error);
    showNotification('Failed to delete recording.', 'error');
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "error"
            ? "exclamation-circle"
            : "info-circle"
        }"></i>
        <span>${message}</span>
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

updateActionText();
