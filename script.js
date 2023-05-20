let mediaRecorder;
let recordedChunks = [];

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const video = document.getElementById("video");
const downloadButton = document.getElementById("downloadButton");

startButton.addEventListener("click", () => {
  // navigator.mediaDevices
  //   .getDisplayMedia({
  //     video: { mediaSource: "screen" },
  //     audio: {
  //       echoCancellation: true,
  //       noiseSuppression: true,
  //       sampleRate: 44100,
  //     },
  //   })
  //   .then((stream) => {
  //     mediaRecorder = new MediaRecorder(stream);
  //     mediaRecorder.ondataavailable = (event) =>
  //       handleDataAvailable(event, stream);
  //     mediaRecorder.start();
  //     startButton.disabled = true;
  //     stopButton.disabled = false;
  //   })
  //   .catch((err) => {
  //     console.error("Error: " + err);
  //   });
  navigator.mediaDevices.getDisplayMedia({ video: true })
  .then(function(screenStream) {
    navigator.mediaDevices.getUserMedia({ audio: { mediaSource: 'system' } })
      .then(function(audioStream) {
        const combinedStream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
        mediaRecorder = new MediaRecorder(combinedStream);
        mediaRecorder.ondataavailable = function(event) {
          recordedChunks.push(event.data);
        };
        // mediaRecorder.onstop = function() {
        //   const blob = new Blob(recordedChunks, { type: 'video/webm' });
        //   const url = URL.createObjectURL(blob);
        //   const video = document.createElement('video');
        //   video.src = url;
        //   video.controls = true;
        //   document.body.appendChild(video);

        //   const a = document.createElement('a');
        //   a.href = url;
        //   a.download = 'screen-record.webm';
        //   a.textContent = 'Download';
        //   document.body.appendChild(a);
        // };
        mediaRecorder.start();
            startButton.disabled = true;
      stopButton.disabled = false;
      })
      .catch(function(err) {
        console.log('Microphone access failed: ' + err);
      });
  })
  .catch(function(err) {
    console.log('Screen access failed: ' + err);
  });
});

stopButton.addEventListener("click", () => {
  mediaRecorder.stop();
  startButton.disabled = false;
  stopButton.disabled = true;
  downloadButton.disabled = false;
  const tracks = mediaRecorder.stream.getTracks();
  tracks.forEach(function(track) {
    track.stop();
  });
  // mediaRecorder.onstop = function() {
  //   const blob = new Blob(recordedChunks, { type: 'video/webm' });
  //   const url = URL.createObjectURL(blob);
  //   const video = document.createElement('video');
  //   video.src = url;
  //   video.controls = true;
  //   document.body.appendChild(video);

  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = 'screen-record.webm';
  //   a.textContent = 'Download';
  //   document.body.appendChild(a);
  // };
});

function download() {
  const blob = new Blob(recordedChunks, {
    type: "video/webm",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "screen-record.webm";
  a.click();
  window.URL.revokeObjectURL(url);
  // const blob = new Blob(recordedChunks, { type: 'video/webm' });
  // const url = URL.createObjectURL(blob);
  // const video = document.createElement('video');
  // video.src = url;
  // video.controls = true;
  // document.body.appendChild(video);

  // const a = document.createElement('a');
  // a.href = url;
  // a.download = 'screen-record.webm';
  // a.textContent = 'Download';
  // document.body.appendChild(a);
}
function handleDataAvailable(event, stream) {
  console.log("Data available...");
  recordedChunks.push(event.data);
  if (mediaRecorder.state === "inactive") {
    const tracks = stream.getTracks();
    if (tracks.length > 1) {
      downloadButton.disabled = false;
    }
  }
}
