import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import OpenAI from "openai";
import { TranslationServiceClient } from "@google-cloud/translate";
import { preprocessAudioDSP } from "./audioPreprocess.js";
import { base64ToArrayBuffer, pcmToWav } from "./wavHelper.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const upload = multer({ storage: multer.memoryStorage() });

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const translationClient = new TranslationServiceClient();

// DSP: Audio Preprocessing from Root Directory
async function preprocessAudioFromRoot() {
  const inputPath = "./test_sample.wav";
  const outputPath = "./cleaned_audio.wav";

  if (!fs.existsSync(inputPath)) {
    throw new Error("test_sample.wav not found in root directory");
  }

  const rawAudioBuffer = fs.readFileSync(inputPath);
  const cleanedBuffer = await preprocessAudioDSP(rawAudioBuffer);

  fs.writeFileSync(outputPath, cleanedBuffer);
  return outputPath;
}

// OpenAI Whisper: Assamese Speech to Assamese Text
async function speechToAssameseText(audioPath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "gpt-4o-mini-transcribe",
    prompt: "The following audio is spoken in Assamese language.",

    // language: "as",
  });

  if (!transcription.text) {
    throw new Error("Whisper failed to transcribe audio");
  }

  return transcription.text;
}

// Google Translate: Assamese Text to English Text
async function translateAssameseToEnglish(assameseText) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = "global";

  const [response] = await translationClient.translateText({
    parent: `projects/${projectId}/locations/${location}`,
    contents: [assameseText],
    mimeType: "text/plain",
    sourceLanguageCode: "as",
    targetLanguageCode: "en",
  });

  return response.translations[0].translatedText;
}

// Gemini TTS: English Text to English Speech
// async function englishTextToSpeech(englishText) {
//   const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`;

//   const payload = {
//     contents: [{ parts: [{ text: englishText }] }],
//     generationConfig: {
//       responseModalities: ["AUDIO"],
//       speechConfig: {
//         voiceConfig: {
//           prebuiltVoiceConfig: { voiceName: "Puck" },
//         },
//       },
//     },
//   };

//   const response = await axios.post(ttsUrl, payload, {
//     headers: { "Content-Type": "application/json" },
//   });

//   const audioBase64 =
//     response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

//   if (!audioBase64) {
//     throw new Error("Gemini TTS did not return audio");
//   }

//   const pcmData = base64ToArrayBuffer(audioBase64);
//   const pcm16 = new Int16Array(pcmData);
//   const wavBlob = pcmToWav(pcm16, 24000);
//   const wavBuffer = Buffer.from(await wavBlob.arrayBuffer());

//   fs.writeFileSync("./final_english_audio.wav", wavBuffer);
// }

async function englishTextToSpeech(englishText) {
  const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: englishText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Puck" },
        },
      },
    },
  };

  const response = await axios.post(ttsUrl, payload, {
    headers: { "Content-Type": "application/json" },
  });

  const audioBase64 =
    response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error("Gemini TTS did not return audio");
  }

  const pcmData = base64ToArrayBuffer(audioBase64);
  const pcm16 = new Int16Array(pcmData);
  const wavBlob = pcmToWav(pcm16, 24000);
  const wavBuffer = Buffer.from(await wavBlob.arrayBuffer());

  // ✅ RETURN audio instead of writing to disk
  return wavBuffer;
}

app.post("/api/translate-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file not provided" });
  }

  const tempId = uuidv4();
  const rawPath = `./temp/raw_${tempId}.wav`;
  const cleanedPath = `./temp/cleaned_${tempId}.wav`;

  try {
    console.log("▶ Received audio from frontend");

    /* STEP 1: SAVE RAW AUDIO */
    fs.writeFileSync(rawPath, req.file.buffer);

    /* STEP 2: DSP PREPROCESSING */
    console.log("▶ DSP preprocessing...");
    const cleanedBuffer = await preprocessAudioDSP(req.file.buffer);
    fs.writeFileSync(cleanedPath, cleanedBuffer);

    /* STEP 3: WHISPER STT */
    console.log("▶ Whisper STT...");
    const assameseText = await speechToAssameseText(cleanedPath);

    /* STEP 4: TRANSLATION */
    console.log("▶ Translating...");
    const englishText = await translateAssameseToEnglish(assameseText);

    /* STEP 5: GEMINI TTS */
    console.log("▶ Gemini TTS...");
    const finalAudioBuffer = await englishTextToSpeech(englishText);

    /* CLEANUP */
    fs.unlinkSync(rawPath);
    fs.unlinkSync(cleanedPath);

    /* RESPONSE */
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", finalAudioBuffer.length);
    res.send(finalAudioBuffer);
  } catch (error) {
    console.error("Pipeline error:", error);

    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(cleanedPath)) fs.unlinkSync(cleanedPath);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Full Pipeline Test Endpoint
app.get("/api/test-full-pipeline", async (req, res) => {
  try {
    console.log("▶ DSP preprocessing...");
    const cleanedAudioPath = await preprocessAudioFromRoot();

    console.log("▶ Whisper STT...");
    const assameseText = await speechToAssameseText(cleanedAudioPath);

    console.log("▶ Translation...");
    const englishText = await translateAssameseToEnglish(assameseText);

    console.log("▶ Gemini TTS...");
    await englishTextToSpeech(englishText);

    res.json({
      success: true,
      assameseText,
      englishText,
      outputAudio: "final_english_audio.wav",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log("Test full pipeline → /api/test-full-pipeline");
});
