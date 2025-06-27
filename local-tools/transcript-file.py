import os
import sys
import numpy as np
import librosa
import whisper
import soundfile as sf
from sklearn.cluster import KMeans
from uisrnn import UISRNN
from python_speech_features import mfcc

SEGMENT_DURATION = 10  # seconds

def extract_mfcc_features(audio_segment, sr):
    mfcc_features = mfcc(audio_segment, sr, winlen=0.025, winstep=0.01, numcep=13)
    return np.mean(mfcc_features, axis=0)

def load_segments(audio_path, sr=16000, duration=10):
    y, orig_sr = librosa.load(audio_path, sr=sr)
    total_length = len(y) / sr
    for i in range(0, int(total_length), duration):
        start = i
        end = min(i + duration, total_length)
        start_sample = int(start * sr)
        end_sample = int(end * sr)
        yield y[start_sample:end_sample], start, end

# === Handle input
if len(sys.argv) < 2:
    print("Usage: python transcribe_segmented.py path/to/audio")
    sys.exit(1)

audio_path = sys.argv[1]
if not os.path.isfile(audio_path):
    print(f"File not found: {audio_path}")
    sys.exit(1)

output_path = os.path.splitext(audio_path)[0] + ".txt"

print("🔊 Loading Whisper model...")
model = whisper.load_model("base")

segments = []
embeddings = []

print("📚 Processing audio in chunks...")
for audio_chunk, start_time, end_time in load_segments(audio_path, duration=SEGMENT_DURATION):
    if len(audio_chunk) < 16000:
        continue

    sf.write("temp_chunk.wav", audio_chunk, samplerate=16000)
    result = model.transcribe("temp_chunk.wav", language="en", verbose=False)
    
    segments.append({
        "start": start_time,
        "end": end_time,
        "text": result["text"].strip()
    })

    emb = extract_mfcc_features(audio_chunk, 16000)
    embeddings.append(emb)

os.remove("temp_chunk.wav")

# === Clustering speakers
print("🧠 Clustering speakers...")
kmeans = KMeans(n_clusters=2, random_state=0).fit(embeddings)
labels = kmeans.labels_

# === Group by speaker and continuity
print("🧩 Reconstructing speaker paragraphs...")
grouped = []
current_speaker = labels[0]
current_text = segments[0]['text']

for i in range(1, len(segments)):
    speaker = labels[i]
    text = segments[i]['text']
    
    if speaker == current_speaker:
        current_text += " " + text
    else:
        grouped.append((current_speaker, current_text.strip()))
        current_speaker = speaker
        current_text = text

grouped.append((current_speaker, current_text.strip()))

# === Output
print("📝 Writing output transcript...")
with open(output_path, "w", encoding="utf-8") as f:
    for speaker_id, paragraph in grouped:
        speaker_name = f"Speaker {speaker_id + 1}"
        f.write(f"{speaker_name}:\n{paragraph}\n\n")

print(f"✅ Done! Transcript saved to: {output_path}")
