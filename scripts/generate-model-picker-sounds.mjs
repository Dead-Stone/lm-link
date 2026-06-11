/**
 * Soft two-tone chimes (AirPods connect/disconnect feel) for the model picker.
 * Padded to >=1s for reliable first-play on Android (expo-audio SDK 54).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/sounds");
const SAMPLE_RATE = 44100;
const MIN_DURATION_SEC = 1.05;

function toneSample(freq, t, duration, volume = 0.32) {
  if (t >= duration) return 0;
  const attack = 0.006;
  const env = t < attack ? t / attack : Math.exp(-(t - attack) * 9.5);
  const fundamental = Math.sin((2 * Math.PI * freq * t) / 1);
  const harmonic = Math.sin((2 * Math.PI * freq * 2 * t) / 1) * 0.08;
  return (fundamental + harmonic) * env * volume;
}

function buildChime(notes) {
  const totalSamples = Math.ceil(MIN_DURATION_SEC * SAMPLE_RATE);
  const buf = new Float32Array(totalSamples);
  for (const note of notes) {
    const startSample = Math.floor(note.start * SAMPLE_RATE);
    const durSamples = Math.floor(note.duration * SAMPLE_RATE);
    for (let i = 0; i < durSamples; i++) {
      const t = i / SAMPLE_RATE;
      const idx = startSample + i;
      if (idx < totalSamples) {
        buf[idx] += toneSample(note.freq, t, note.duration, note.vol ?? 0.32);
      }
    }
  }
  for (let i = 0; i < totalSamples; i++) {
    buf[i] = Math.max(-0.95, Math.min(0.95, buf[i]));
  }
  return buf;
}

function writeWav(floatSamples, filePath) {
  const numSamples = floatSamples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(floatSamples[i] * 32767);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

const connect = buildChime([
  { freq: 987.77, start: 0, duration: 0.11, vol: 0.3 },
  { freq: 1318.51, start: 0.13, duration: 0.17, vol: 0.27 },
]);

const disconnect = buildChime([
  { freq: 783.99, start: 0, duration: 0.12, vol: 0.28 },
  { freq: 587.33, start: 0.15, duration: 0.19, vol: 0.24 },
]);

fs.mkdirSync(OUT_DIR, { recursive: true });
writeWav(connect, path.join(OUT_DIR, "model-picker-connect.wav"));
writeWav(disconnect, path.join(OUT_DIR, "model-picker-disconnect.wav"));
console.log("Wrote model-picker-connect.wav and model-picker-disconnect.wav");
