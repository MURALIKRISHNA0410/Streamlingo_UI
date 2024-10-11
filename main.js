const createBtn = document.querySelector("#createBtn");
const joinBtn = document.querySelector("#joinBtn");
const userInput = document.querySelector("#userInput");
const roomInput = document.querySelector("#roomInput");
const usersConnected = document.querySelector("#usersConnected");
const userInputDiv = document.querySelector("#userInputDiv");
const usersConnectedHeading = document.querySelector("#userConnectedHeading");
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");
const streamLingoBtn = document.querySelector("#streamLingo");
const transcriptionDiv = document.querySelector("#transcription");
const translationStatus = document.querySelector("#transcriptionLabel");

const socket = io("https://suited-working-barnacle.ngrok-free.app/");
const currentUrl = new URL(window.location.href);
let localStream;

let audioContext, audioWorkletNode;
let pushStream, manish;

let isStreamLingoEnabled = false;

const API_KEY = "33c8d69d70f0449ea11d21ea6f27be0b";
const API_REGION = "eastus";

const SOURCE_LANG = "en-US";
const TARGET_LANG = "hi";

const SPEECH_LANG = "hi-IN-MadhurNeural";

//////////////////////\ Peer Connection Setup /\\\\\\\\\\\\\\\\\\\\\\\\\\

const PeerConnection = (function () {
  let pc;
  const createPeerConnection = () => {
    const config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
    pc = new RTCPeerConnection(config);

    //Local Stream;
    localStream.getTracks().forEach((tracks) => {
      pc.addTrack(tracks, localStream);
    });

    //Remote Stream;
    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    //ice candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("icecandidate", event.candidate);
      }
    };
    return pc;
  };

  return {
    getInstance: () => {
      if (!pc) {
        pc = createPeerConnection();
      }
      return pc;
    },
  };
})();

//////////////////////\ Event Lsisteners /\\\\\\\\\\\\\\\\\\\\\\\\\\

createBtn.addEventListener("click", () => {
  const username = userInput.value.trim();
  const roomNumber = randomRoomNumber();
  if (username !== "") {
    socket.emit("join-user", { roomNumber, username });
    userInputDiv.innerHTML = `ROOM NUMBER ${roomNumber}.`;
  } else {
    alert("Please Fill the Places");
  }
});

joinBtn.addEventListener("click", () => {
  const username = userInput.value.trim();
  const roomNumber = parseInt(roomInput.value);
  if (username && roomNumber !== "") {
    socket.emit("join-user", { roomNumber, username });
    // userInputDiv.innerHTML = `ROOM NUMBER ${roomNumber}.`
  } else {
    alert("Please Fill the Places");
  }
});

//////////////////////\ Sockets.io /\\\\\\\\\\\\\\\\\\\\\\\\\\

socket.on("connected", (data) => {
  // console.log(data);
});

socket.on("room-full", (roomNumber) => {
  const app = document.querySelector("#app");
  app.innerHTML = `ROOM ${roomNumber} FULL.`;
  app.classList.add("room-full");
});

socket.on("joined", ({ roomNumber, username }) => {
  console.log(username, roomNumber);
});

socket.on("allUsers", (data) => {
  usersConnectedHeading.innerHTML = `Users Connected in Room ${data.roomNumber}`;
  const createUsersHtml = () => {
    const li = document.createElement("li");
    li.textContent = `${data.username}. ${
      data.username === userInput.value ? "(You)" : ""
    }`;
    if (data.username !== userInput.value) {
      const button = document.createElement("button");
      button.classList.add("call-btn");
      button.textContent = "Call";
      button.addEventListener("click", (e) => {
        startCall(data.username);
      });
      li.append(button);
    }
    usersConnected.appendChild(li);
  };
  createUsersHtml();
  userInputDiv.style.display = "none";
  streamLingoBtn.style.display = "inline-block";
});

socket.on("offer", async ({ from, to, offer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { from, to, answer: pc.localDescription });
});

socket.on("answer", async ({ from, to, answer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(answer);
});

socket.on("icecandidate", async (candidate) => {
  // console.log({ candidate });
  const pc = PeerConnection.getInstance();
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("audioData", (data) => {
  console.log(data);
  playTranslatedSpeech(data);
});

////////////////////\ Funtions /\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function randomRoomNumber() {
  const randomNumber = Math.floor(Math.random() * 100) + 1;
  return randomNumber;
}

const startCall = async (user) => {
  // console.log({ user })
  const pc = PeerConnection.getInstance();
  const offer = await pc.createOffer();
  // console.log({ offer })
  await pc.setLocalDescription(offer);
  socket.emit("offer", {
    from: userInput.value,
    to: user,
    offer: pc.localDescription,
  });
};

// initialize app
const startMyVideo = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    initAudioWorkletNode(stream);
    localStream = stream;
    localVideo.srcObject = stream;
  } catch (error) {
    console.log("StreamError:" + error);
  }
};

startMyVideo();

async function initAudioWorkletNode(localStream) {
  audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule("audio-processor.js");
  const source = audioContext.createMediaStreamSource(localStream);
  audioWorkletNode = new AudioWorkletNode(audioContext, "audio-processor");
  source.connect(audioWorkletNode);
  audioWorkletNode.connect(audioContext.destination);

  console.log("Before Azure");
  azureASR();

  audioWorkletNode.port.onmessage = (event) => {
    const audioData = event.data;
    pushStream.write(audioData.buffer);
  };
}

/////////////////AZURE//////////////////////////////

async function azureASR() {
  pushStream = SpeechSDK.AudioInputStream.createPushStream();
  const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = SpeechSDK.SpeechTranslationConfig.fromSubscription(
    API_KEY,
    API_REGION
  );
  speechConfig.speechRecognitionLanguage = SOURCE_LANG;
  speechConfig.addTargetLanguage(TARGET_LANG);
  manish = new SpeechSDK.TranslationRecognizer(speechConfig, audioConfig);

  manish.recognizing = (s, e) => {
    const translation = e.result.translations.get(TARGET_LANG);
    transcriptionDiv.innerText += translation + "\n";
    azureSpeech(translation);
  };

  streamLingoBtn.addEventListener("click", () => {
    isStreamLingoEnabled = !isStreamLingoEnabled;
    if (isStreamLingoEnabled) {
      translationStatus.innerHTML = `Transaltion Service ON`;
      console.log("Into recognition");
      manish.startContinuousRecognitionAsync();
    } else {
      translationStatus.innerHTML = `Transaltion Service OFF`;
      manish.stopContinuousRecognitionAsync();
      audioWorkletNode.disconnect();
      audioContext.close();
      pushStream.close();
    }
  });
}

async function azureSpeech(text) {
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
    "33c8d69d70f0449ea11d21ea6f27be0b",
    "eastus"
  );

  // Create an empty stream to avoid playing the audio locally
  const stream = new SpeechSDK.PushAudioOutputStreamCallback();

  const audioConfig = SpeechSDK.AudioConfig.fromStreamOutput(stream);
  speechConfig.speechSynthesisVoiceName = SPEECH_LANG;

  const speechSynthesizer = new SpeechSDK.SpeechSynthesizer(
    speechConfig,
    audioConfig
  );

  speechSynthesizer.speakTextAsync(
    text,
    (result) => {
      if (result) {
        // Emit the audio data without playing it locally
        socket.emit("translatedSpeech", result.audioData);
        speechSynthesizer.close();
      }
    },
    (error) => {
      console.log(error);
      speechSynthesizer.close();
    }
  );
}

function playTranslatedSpeech(audioData) {
  const audioContext = new AudioContext();
  audioContext.decodeAudioData(audioData, (buffer) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  });
}
