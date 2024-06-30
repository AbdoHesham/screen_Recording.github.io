let mediaRecorder;
let recordedChunks = [];

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const downloadButton = document.getElementById("downloadButton");
const video = document.getElementById("recordedVideo");

startButton.addEventListener("click", () => {
  const displayOptions = { video: true };
  const audioOptions = {};

  // if (document.getElementById('systemSound').checked && !document.getElementById('micSound').checked) {
  //   audioOptions.audio = { mediaSource: 'system' };
  // } else if (!document.getElementById('systemSound').checked && document.getElementById('micSound').checked) {
  //   audioOptions.audio = true;
  // } else if (document.getElementById('systemSound').checked && document.getElementById('micSound').checked) {
  //   audioOptions.audio = { mediaSource: 'system' };
  // }

  navigator.mediaDevices.getDisplayMedia(displayOptions)
    .then(function(screenStream) {
      // if (Object.keys(audioOptions).length !== 0) {
        navigator.mediaDevices.getUserMedia({ audio: { mediaSource: 'system' } })
          .then(function(audioStream) {
            const combinedStream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
            setupMediaRecorder(combinedStream);
          })
          .catch(function(err) {
            console.log('Microphone access failed: ' + err);
          });
      // } else {
      //   setupMediaRecorder(screenStream);
      // }
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
  };

  mediaRecorder.start();
  startButton.disabled = true;
  stopButton.disabled = false;
}

stopButton.addEventListener("click", () => {
  mediaRecorder.stop();
  startButton.disabled = false;
  stopButton.disabled = true;

  const tracks = mediaRecorder.stream.getTracks();
  tracks.forEach(function(track) {
    track.stop();
  });
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
