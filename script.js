let mediaRecorder;
let recordedChunks = [];
let transcribedText = '';
let recognizing = false;
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const downloadButton = document.getElementById("downloadButton");
const downloadWordButton = document.getElementById("downloadWordButton");
const video = document.getElementById("recordedVideo");
let audioStream = null;
let audioStreamRequested = false;

let recognization = new webkitSpeechRecognition();
recognization.continuous = true;
recognization.interimResults = true;

recognization.onresult = (event) => {
  let interim_transcript = '';
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) {
      transcribedText += event.results[i][0].transcript;
    } else {
      interim_transcript += event.results[i][0].transcript;
    }
  }
  document.getElementById("output").innerHTML = transcribedText + '<br>' + interim_transcript;
};

async function getAudioStream() {
  if (!audioStreamRequested) {
    audioStreamRequested = true;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.log('Microphone access failed: ' + err);
      audioStreamRequested = false;
    }
  }
  return audioStream;
}

startButton.addEventListener("click", async () => {
  const displayOptions = { video: true };

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
    const audioStream = await getAudioStream();
    const combinedStream = audioStream ? new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]) : screenStream;
    setupMediaRecorder(combinedStream);
    const language = document.getElementById("languageSelect").value;
    recognization.lang = language;
    recognization.start();
  } catch (err) {
    console.log('Screen or audio access failed: ' + err);
  }
});

function setupMediaRecorder(stream) {
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = function(event) {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = function() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    video.src = url;
    video.controls = true;
    downloadButton.disabled = false;
    downloadWordButton.disabled = false;
  };

  mediaRecorder.start();
  startButton.disabled = true;
  stopButton.disabled = false;
  pauseButton.disabled = false;
  resumeButton.disabled = true;
}

stopButton.addEventListener("click", () => {
  mediaRecorder.stop();
  recognization.stop();

  startButton.disabled = false;
  stopButton.disabled = true;
  pauseButton.disabled = true;
  resumeButton.disabled = true;

  const tracks = mediaRecorder.stream.getTracks();
  tracks.forEach(function(track) {
    track.stop();
  });
});

pauseButton.addEventListener("click", () => {
  mediaRecorder.pause();
  pauseButton.disabled = true;
  resumeButton.disabled = false;
});

resumeButton.addEventListener("click", () => {
  mediaRecorder.resume();
  pauseButton.disabled = false;
  resumeButton.disabled = true;
});

function download() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "screen-record.webm";
  a.click();
  window.URL.revokeObjectURL(url);
}

function downloadWord() {
  const content = `<!DOCTYPE html>
    <html>
      <body>
        <p>${transcribedText}</p>
      </body>
    </html>`;
  const blob = new Blob([content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "transcribed.doc";
  a.click();
  window.URL.revokeObjectURL(url);
}