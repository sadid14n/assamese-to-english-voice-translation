import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import axios from "axios";
import { SpeechClient } from "@google-cloud/speech";
import { TranslationServiceClient } from "@google-cloud/translate";
import { base64ToArrayBuffer, pcmToWav } from "./wavHelper.js";
import fs from "fs";
import { preprocessAudioDSP } from "./audioPreprocess.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Google Cloud Clients
const speechClient = new SpeechClient();
const translationClient = new TranslationServiceClient();

/* ---------------------------------------------------------
   STEP 2 & STEP 3 → Translate Assamese → English + Gemini TTS
--------------------------------------------------------- */
async function translateAndSynthesize(assameseText) {
  console.log("Step 2: Translating Assamese → English...");

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = "global";

  const [translationResponse] = await translationClient.translateText({
    parent: `projects/${projectId}/locations/${location}`,
    contents: [assameseText],
    mimeType: "text/plain",
    sourceLanguageCode: "as",
    targetLanguageCode: "en",
  });

  const englishText = translationResponse.translations[0].translatedText;
  console.log("English Translation:", englishText);

  console.log("Step 3: Generating English Speech (Gemini TTS)...");

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`;

  const ttsPayload = {
    contents: [{ parts: [{ text: englishText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
      },
    },
    model: "gemini-2.5-flash-preview-tts",
  };

  const ttsResponse = await axios.post(ttsUrl, ttsPayload, {
    headers: { "Content-Type": "application/json" },
  });

  const audioData =
    ttsResponse.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) throw new Error("Gemini did not return audio.");

  const pcmData = base64ToArrayBuffer(audioData);
  const pcm16 = new Int16Array(pcmData);
  const wavBlob = pcmToWav(pcm16, 24000);
  const wavBuffer = Buffer.from(await wavBlob.arrayBuffer());

  return { assameseText, englishText, wavBuffer };
}

/* ---------------------------------------------------------
   FULL PIPELINE → Speech → Assamese Text → English → TTS
--------------------------------------------------------- */
async function runTranslationPipeline(audioBuffer, encoding, sampleRateHertz) {
  console.log("Step 1: Speech-to-Text (Assamese)...");

  const audioBytes = audioBuffer.toString("base64");

  const speechConfig = {
    encoding,
    sampleRateHertz,
    languageCode: "as-IN",
    useEnhanced: true,
    speechContexts: [
      {
        phrases: [
          "মই",
          "এজন",
          "ছাত্ৰ",
          "ভাল",
          "আছোঁ",
          "তুমি",
          "কেনে",
          "আছা",
          "কি",
          "খবৰ",
          "ধন্যবাদ",
          "আপোনাৰ",
          "নাম",
          "ঘৰ",
          "ক'ত",
          "নমস্কাৰ",
        ],
      },
    ],
  };

  const [speechResponse] = await speechClient.recognize({
    audio: { content: audioBytes },
    config: speechConfig,
  });

  const assameseText = speechResponse.results
    .map((r) => r.alternatives[0].transcript)
    .join("\n");

  if (!assameseText) throw new Error("Could not understand audio.");

  console.log("Assamese Text:", assameseText);

  return await translateAndSynthesize(assameseText);
}

/* ---------------------------------------------------------
   ENDPOINT 1: PRODUCTION AUDIO PIPELINE
--------------------------------------------------------- */
app.post("/api/translate", upload.single("audio"), async (req, res) => {
  console.log("Received audio upload...");

  if (!req.file)
    return res.status(400).json({ error: "No audio file provided." });

  try {
    const { wavBuffer } = await runTranslationPipeline(
      req.file.buffer,
      "WEBM_OPUS",
      48000
    );

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", wavBuffer.length);
    res.send(wavBuffer);

    console.log("Response sent to client successfully.");
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------------
   ENDPOINT 2: TEXT → ENGLISH SPEECH
--------------------------------------------------------- */
app.post("/api/text-translate", async (req, res) => {
  console.log("Received text-translate request...");

  const assameseText = req.body.text;
  if (!assameseText)
    return res.status(400).json({ error: "No text provided." });

  try {
    const { englishText, wavBuffer } = await translateAndSynthesize(
      assameseText
    );

    res.setHeader("Content-Type", "audio/wav");
    res.send(wavBuffer);

    console.log("Text translation completed:", englishText);
  } catch (error) {
    console.error("Text translation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------------
   ENDPOINT 3: TEST TEXT PIPELINE
--------------------------------------------------------- */
app.get("/api/test-text", async (req, res) => {
  console.log("Running test-text...");

  const testText =
    "মই এজন ছাত্ৰ | মোৰ নাম নগেন | মই জীৱ জন্তু ভাল পাওঁ | উদ্য়োগীসকল হ'ল এনে ব্য়ক্তি যিয়ে নিজে ব্য়ৱসায় বা উদ্য়োগ আৰম্ভ কৰি কোনো বস্তু বা সেৱা বিক্ৰী কৰি নিজৰ জীৱিকা উলিওৱাৰ লগতে আনকো কৰ্ম সংস্থান দিবলৈ সক্ষম হয়।";

  try {
    const { englishText, wavBuffer } = await translateAndSynthesize(testText);

    fs.writeFileSync("./text_translation_output.txt", englishText);
    fs.writeFileSync("./text_translated_output.wav", wavBuffer);

    res.json({
      success: true,
      message: "Test text pipeline ran successfully.",
      englishText,
    });
  } catch (error) {
    console.error("Test-text error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------------
   ENDPOINT 4: TEST AUDIO FILE PIPELINE
--------------------------------------------------------- */
app.get("/api/test", async (req, res) => {
  console.log("Running test-audio...");

  const testFile = "./test_sample.wav";

  if (!fs.existsSync(testFile))
    return res.status(404).json({ error: "test_sample.wav not found." });

  try {
    const audioBuffer = fs.readFileSync(testFile);

    const { assameseText, englishText, wavBuffer } =
      await runTranslationPipeline(audioBuffer, "LINEAR16", 48000);

    fs.writeFileSync("./stt_output.txt", assameseText);
    fs.writeFileSync("./translation_output.txt", englishText);
    fs.writeFileSync("./translated_output.wav", wavBuffer);

    res.json({
      success: true,
      message: "Audio pipeline test completed.",
      assameseText,
      englishText,
    });
  } catch (error) {
    console.error("Test error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------------
   START SERVER
--------------------------------------------------------- */

// Audio Cleaned Check
/* ---------------------------------------------------------
   SAMPLE FUNCTION: TEST DSP AUDIO CLEANUP
--------------------------------------------------------- */
async function testAudioDSPCleanup() {
  console.log("Running DSP Audio Cleanup Test...");

  const inputFile = "./test_sample.wav";
  const outputFile = "./cleaned_test_sample.wav";

  if (!fs.existsSync(inputFile)) {
    console.error("❌ test_sample.wav not found in root folder.");
    return;
  }

  try {
    // Read raw audio
    const rawAudioBuffer = fs.readFileSync(inputFile);

    // Preprocess using DSP
    const cleanedAudioBuffer = await preprocessAudioDSP(rawAudioBuffer);

    // Write cleaned audio to root folder
    fs.writeFileSync(outputFile, cleanedAudioBuffer);

    console.log("✅ Audio preprocessing completed successfully.");
    console.log(`📁 Cleaned file saved as: ${outputFile}`);
  } catch (error) {
    console.error("❌ DSP Audio Cleanup failed:", error);
  }
}

/* ---------------------------------------------------------
   ENDPOINT: TEST DSP AUDIO CLEANUP ONLY
--------------------------------------------------------- */
app.get("/api/test-dsp", async (req, res) => {
  try {
    await testAudioDSPCleanup();
    res.json({
      success: true,
      message: "DSP audio preprocessing test completed.",
      outputFile: "cleaned_test_sample.wav",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Test (audio):     http://localhost:5000/api/test");
  console.log("Test (text):      http://localhost:5000/api/test-text");
});
