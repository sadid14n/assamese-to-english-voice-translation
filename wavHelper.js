/*
 * This is a helper utility to convert the raw PCM audio data from the
 * Gemini TTS API into a valid WAV file format that browsers can play.
 *
 * The Gemini TTS API returns signed 16-bit PCM (L16) audio.
 * This file adds the necessary 44-byte WAV header.
 */

/**
 * Decodes a Base64 string into an ArrayBuffer.
 * @param {string} base64 The Base64-encoded string.
 * @returns {ArrayBuffer} The decoded binary data.
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Creates a WAV Blob from raw PCM data.
 * @param {Int16Array} pcmData The raw 16-bit PCM data.
 * @param {number} sampleRate The sample rate (e.g., 24000).
 * @returns {Blob} A Blob object representing the WAV file.
 */
export function pcmToWav(pcmData, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length * (bitsPerSample / 8);
  const totalSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true); // file-size - 8
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM data
  const pcm16 = new Int16Array(buffer, 44);
  pcm16.set(pcmData);

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Helper to write a string to a DataView.
 * @param {DataView} view The DataView to write to.
 *a* @param {number} offset The offset to write at.
 * @param {string} string The string to write.
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
