import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import path from "path";

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Audio DSP Preprocessing Function
 * --------------------------------
 * Input  : Raw audio buffer (from frontend upload)
 * Output : Cleaned audio buffer (WAV, 16kHz, mono)
 *
 * Processing applied:
 * - Noise reduction
 * - Band-pass filtering (speech range)
 * - Silence removal
 * - Volume normalization
 */
export async function preprocessAudioDSP(inputBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const id = uuidv4();
      const tempDir = "./temp";

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const inputPath = path.join(tempDir, `raw_${id}.wav`);
      const outputPath = path.join(tempDir, `clean_${id}.wav`);

      // Write raw buffer to file
      fs.writeFileSync(inputPath, inputBuffer);

      ffmpeg(inputPath)
        .audioFilters([
          "highpass=f=80", // Remove low-frequency hum
          "lowpass=f=8000", // Remove high-frequency noise
          "afftdn", // Noise reduction
          "silenceremove=1:0:-50dB", // Remove silent parts
          "loudnorm", // Normalize volume
        ])
        .audioFrequency(16000) // STT-friendly sample rate
        .audioChannels(1) // Mono audio
        .format("wav")
        .on("end", () => {
          const cleanedBuffer = fs.readFileSync(outputPath);

          // Cleanup temp files
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);

          resolve(cleanedBuffer);
        })
        .on("error", (err) => {
          reject(err);
        })
        .save(outputPath);
    } catch (error) {
      reject(error);
    }
  });
}
