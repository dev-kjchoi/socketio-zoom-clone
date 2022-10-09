const socket = io();

// Video Araa
const video = document.getElementById("video");
const myVideo = document.getElementById("myVideo");
const camerasSelect = document.getElementById("cameras");
const cameraBtn = document.getElementById("camera");
const muteBtn = document.getElementById("mute");

video.hidden = true;

let myVideoStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices;
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myVideoStream.getVideoTracks()[0];

    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMyVideoStream(deviceId) {
  const init = {
    video: { facingMode: "user" },
    audio: true
  };
  const chosed = {
    video: { deviceId: { exact: deviceId } },
    audio: true
  };
  try {
    myVideoStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? chosed : init
    );
    myVideo.srcObject = myVideoStream;
    if (!deviceId) {
      await getCamera();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myVideoStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (!muted) {
    muteBtn.innerText = "음소거 끄기";
    muted = true;
  } else {
    muteBtn.innerText = "음소거";
    muted = false;
  }
}

function handleCameraClick() {
  myVideoStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (!cameraOff) {
    cameraBtn.innerText = "카메라 켜기";
    cameraOff = true;
  } else {
    cameraBtn.innerText = "카메라 끄기";
    cameraOff = false;
  }
}

async function handleCameraChange() {
  await getMyVideoStream(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myPeerConnection.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Room Area
const room = document.getElementById("room");
const roomForm = room.querySelector("form");

async function startMyVideoStream() {
  room.hidden = true;
  video.hidden = false;
  await getMyVideoStream();
  makeConnection();
}

async function handleRoomFormSubmit(event) {
  event.preventDefault();
  const input = roomForm.querySelector("input");
  roomName = input.value;
  await startMyVideoStream();
  socket.emit("join_room", roomName);
  input.value = "";
}

roomForm.addEventListener("submit", handleRoomFormSubmit);

// Socket Area
socket.on("enter_room", async () => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => console.log(event.data));
  console.log("made data channel");

  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      console.log(event.data)
    );
  });

  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);

  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  console.log("sent the answer");
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received icecandidate");
  myPeerConnection.addIceCandidate(ice);
});

// RTC Area
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServer: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302"
        ]
      }
    ]
  });

  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);

  myVideoStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myVideoStream));
}

function handleIce(data) {
  console.log("sent icecandidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerVideo = document.getElementById("peerVideo");
  peerVideo.srcObject = data.stream;
}
