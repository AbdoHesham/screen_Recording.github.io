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

if ('webkitSpeechRecognition' in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    recognizing = true;
  };

  recognition.onend = function() {
    recognizing = false;
  };

  recognition.onresult = function(event) {
    let interim_transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        transcribedText += event.results[i][0].transcript;
      } else {
        interim_transcript += event.results[i][0].transcript;
      }
    }
  };

  startButton.addEventListener("click", () => {
    recognition.start();
  });

  stopButton.addEventListener("click", () => {
    recognition.stop();
  });
}

startButton.addEventListener("click", () => {
  const displayOptions = { video: true };

  navigator.mediaDevices.getDisplayMedia(displayOptions)
    .then(function(screenStream) {
      if (!audioStream) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function(stream) {
            audioStream = stream;
            const combinedStream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
            setupMediaRecorder(combinedStream);
          })
          .catch(function(err) {
            console.log('Microphone access failed: ' + err);
          });
      } else {
        const combinedStream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
        setupMediaRecorder(combinedStream);
      }
    })
    .catch(function(err) {
      console.log('Screen access failed: ' + err);
    });
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
  const PizZip = window.pizzip;
  const Docxtemplater = window.docxtemplater;

  // Create a new PizZip instance
  const zip = new PizZip();

  // Define the template content
  const content = `
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r>
            <w:t>{transcribedText}</w:t>
          </w:r>
        </w:p>
      </w:body>
    </w:document>
  `;

  // Load the template into PizZip
  zip.file("word/document.xml", content);

  // Create a new Docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Set the data for the template
  doc.setData({ transcribedText });

  try {
    doc.render();
  } catch (error) {
    console.error(JSON.stringify({ error }, null, 2));
    throw error;
  }

  // Generate the document as a blob
  const out = doc.getZip().generate({ type: "blob" });
  saveAs(out, "transcribed.docx");
}
