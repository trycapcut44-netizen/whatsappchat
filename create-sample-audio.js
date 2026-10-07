const fs = require('fs');
const path = require('path');

// Generate a valid 4-second WAV audio note
const sampleRate = 8000;
const numChannels = 1;
const bitsPerSample = 16;
const durationSec = 3;
const totalSamples = sampleRate * durationSec;
const blockAlign = numChannels * (bitsPerSample / 8);
const byteRate = sampleRate * blockAlign;
const dataSize = totalSamples * blockAlign;
const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(bitsPerSample, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Generate friendly ascending chords / warm voice note tone
let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  // Chord progression: 440Hz -> 554Hz -> 659Hz
  const freq = t < 1.0 ? 440 : (t < 2.0 ? 554.37 : 659.25);
  const envelope = Math.exp(-2.5 * (t % 1.0)); // exponential pluck/decay per note
  const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4 * 32767;
  buffer.writeInt16LE(Math.floor(sample), offset);
  offset += 2;
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

fs.writeFileSync(path.join(uploadsDir, 'sample-greeting.wav'), buffer);
console.log('Sample audio created at uploads/sample-greeting.wav');
