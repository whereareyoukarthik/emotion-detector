const MODEL_URL = "/static/models";
let stream = null;
let detectionInterval = null;
let history = [];

const emotionColors = {
    happy: "#2d6a4f",
    angry: "#9b2226",
    sad: "#023e8a",
    surprised: "#7b2d8b",
    fearful: "#4a4e69",
    disgusted: "#386641",
    neutral: "#333355"
};

function getCharacter(emotion, confidence) {
    if (emotion === "happy" && confidence > 0.5) {
        const surprised = parseFloat(document.getElementById("val-surprised").textContent) / 100;
        if (surprised > 0.3) return "🃏 Joker Detected";
        return confidence > 0.8 ? "😏 Sigma Detected" : "😊 Wholesome NPC";
    }
    if (emotion === "angry") return confidence > 0.7 ? "😤 Karen Activated" : "😠 Main Character Energy";
    if (emotion === "surprised") return confidence > 0.7 ? "😱 Home Alone Face" : "😲 Plot Twist!";
    if (emotion === "disgusted") return "🤢 Gordon Ramsay Mode";
    if (emotion === "fearful") return confidence > 0.6 ? "😨 Friday Night Vibes" : "😰 Anxious NPC";
    if (emotion === "sad") return confidence > 0.6 ? "😢 Villain Arc Begins" : "😔 Emo Phase Unlocked";
    if (emotion === "neutral") return confidence > 0.7 ? "🤖 NPC Detected" : "😐 Poker Face";
    return "🎭 Unknown Entity";
}

async function loadModels() {
    document.getElementById("loadingMsg").style.display = "flex";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    document.getElementById("loadingMsg").style.display = "none";
    document.getElementById("startBtn").disabled = false;
    console.log("Models loaded!");
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.getElementById("video");
        video.srcObject = stream;

        await new Promise(resolve => video.onloadedmetadata = resolve);

        const overlay = document.getElementById("overlay");
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;

        document.getElementById("startBtn").disabled = true;
        document.getElementById("stopBtn").disabled = false;
        document.getElementById("screenshotBtn").disabled = false;
        document.getElementById("noFaceMsg").style.display = "none";

        detectionInterval = setInterval(detectEmotion, 100);
    } catch (err) {
        alert("Camera access denied. Please allow camera permissions.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    const overlay = document.getElementById("overlay");
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    document.getElementById("screenshotBtn").disabled = true;
    document.getElementById("characterLabel").textContent = "🎭 Waiting...";
    document.getElementById("emotionBadge").textContent = "—";
}

async function detectEmotion() {
    const video = document.getElementById("video");
    const overlay = document.getElementById("overlay");
    const ctx = overlay.getContext("2d");

    const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!detections || detections.length === 0) {
        document.getElementById("noFaceMsg").style.display = "flex";
        return;
    }

    document.getElementById("noFaceMsg").style.display = "none";

    // Mirror the canvas to match the mirrored video
    ctx.save();
    ctx.translate(overlay.width, 0);
    ctx.scale(-1, 1);

    const detection = detections[0];
    const box = detection.detection.box;
    const expressions = detection.expressions;

    // Get dominant emotion
    const dominant = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b);
    const emotion = dominant[0];
    const confidence = dominant[1];

    // Draw bounding box
    ctx.strokeStyle = emotionColors[emotion] || "#4361ee";
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw label background
    ctx.fillStyle = "rgba(15, 17, 23, 0.85)";
    ctx.fillRect(box.x, box.y - 50, box.width, 50);

    // Flip text back so it reads correctly
    ctx.save();
    ctx.translate(box.x + box.width / 2, box.y - 35);
    ctx.scale(-1, 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(emotion.toUpperCase(), 0, 0);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "13px Segoe UI";
    ctx.fillText((confidence * 100).toFixed(1) + "%", 0, 18);
    ctx.restore();

    // Get character
    const character = getCharacter(emotion, confidence);

    ctx.restore();

    // Update character card
    document.getElementById("characterLabel").textContent = character;
    document.getElementById("emotionBadge").textContent = emotion.toUpperCase();

    const card = document.getElementById("characterCard");
    card.style.borderColor = emotionColors[emotion] || "#4361ee";
    card.style.background = (emotionColors[emotion] || "#1e1e2e") + "33";

    // Update confidence bar
    const conf = confidence * 100;
    const bar = document.getElementById("confidenceBar");
    bar.style.width = conf + "%";
    bar.style.background = conf > 70 ? "#40916c" : conf > 40 ? "#e9c46a" : "#e63946";
    document.getElementById("confidenceValue").textContent = conf.toFixed(1) + "%";

    // Update all emotion bars
    Object.entries(expressions).forEach(([em, val]) => {
        const b = document.getElementById("bar-" + em);
        const v = document.getElementById("val-" + em);
        if (b) b.style.width = (val * 100) + "%";
        if (v) v.textContent = (val * 100).toFixed(1) + "%";
    });

    // Update history
    history.unshift({ character, emotion, time: new Date().toLocaleTimeString() });
    if (history.length > 5) history.pop();
    document.getElementById("history").innerHTML = history.map(h =>
        `<div class="history-item">
            <span class="history-char">${h.character}</span>
            <span class="history-time">${h.time}</span>
        </div>`
    ).join("");
}

function takeScreenshot() {
    const video = document.getElementById("video");
    const overlay = document.getElementById("overlay");
    const canvas = document.getElementById("screenshotCanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.restore();
    ctx.drawImage(overlay, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/jpeg");
    a.download = "emotion_" + Date.now() + ".jpg";
    a.click();
}

// Load models on page load
loadModels();