import cv2
import numpy as np
from fer import FER
import base64

# Initialize FER detector
detector = FER(mtcnn=False)

# Character mapping
def get_character(emotion, confidence):
    if emotion == "happy":
        if confidence > 80:
            return "😏 Sigma Detected"
        else:
            return "😊 Wholesome NPC"
    elif emotion == "angry":
        if confidence > 70:
            return "😤 Karen Activated"
        else:
            return "😠 Main Character Energy"
    elif emotion == "surprise":
        if confidence > 70:
            return "😱 Home Alone Face"
        else:
            return "😲 Plot Twist!"
    elif emotion == "disgust":
        return "🤢 Gordon Ramsay Mode"
    elif emotion == "fear":
        if confidence > 60:
            return "😨 Friday Night Vibes"
        else:
            return "😰 Anxious NPC"
    elif emotion == "sad":
        if confidence > 60:
            return "😢 Villain Arc Begins"
        else:
            return "😔 Emo Phase Unlocked"
    elif emotion == "neutral":
        if confidence > 70:
            return "🤖 NPC Detected"
        else:
            return "😐 Poker Face"
    return "🎭 Unknown Entity"

def check_joker(emotions):
    # Joker = happy + surprise both above 30%
    happy = emotions.get("happy", 0)
    surprise = emotions.get("surprise", 0)
    if happy > 30 and surprise > 30:
        return True
    return False

def decode_frame(b64_string):
    # Remove header if present
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return frame

def encode_frame(frame):
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def annotate_frame(frame, emotion, character, confidence, x, y, w, h):
    # Draw face bounding box
    cv2.rectangle(frame, (x, y), (x+w, y+h), (67, 97, 238), 2)

    # Background for text
    cv2.rectangle(frame, (x, y-70), (x+w, y), (20, 20, 40), -1)

    # Emotion text
    cv2.putText(frame, emotion.upper(), (x+8, y-45),
        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # Confidence
    cv2.putText(frame, f"{confidence:.1f}%", (x+8, y-25),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 100), 1)

    # Confidence bar
    bar_width = int((w * confidence) / 100)
    cv2.rectangle(frame, (x, y-10), (x+w, y-4), (50, 50, 50), -1)
    cv2.rectangle(frame, (x, y-10), (x+bar_width, y-4), (67, 97, 238), -1)

    return frame

def analyze_frame(b64_string):
    try:
        # Decode frame
        frame = decode_frame(b64_string)
        if frame is None:
            return {"success": False, "message": "Could not decode frame"}

        # Detect emotions
        results = detector.detect_emotions(frame)

        if not results:
            return {"success": False, "message": "No face detected"}

        # Get first face
        face = results[0]
        emotions = face["emotions"]
        box = face["box"]
        x, y, w, h = box

        # Get dominant emotion
        dominant_emotion = max(emotions, key=emotions.get)
        confidence = emotions[dominant_emotion] * 100

        # Check for Joker combo
        if check_joker(emotions):
            character = "🃏 Joker Detected"
            dominant_emotion = "joker"
        else:
            character = get_character(dominant_emotion, confidence)

        # Annotate frame
        frame = annotate_frame(frame, dominant_emotion, character, confidence, x, y, w, h)

        # Encode annotated frame
        annotated_b64 = encode_frame(frame)

        return {
            "success": True,
            "emotion": dominant_emotion,
            "character": character,
            "confidence": round(confidence, 2),
            "annotated_frame": annotated_b64,
            "all_emotions": {k: round(v*100, 1) for k, v in emotions.items()}
        }

    except Exception as e:
        return {"success": False, "message": str(e)}