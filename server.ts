import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads folder statically for external APIs like HeyGen to reach the file
app.use("/uploads", express.static(uploadsDir));

// Initialize Gemini SDK according to official guidelines
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ GEMINI_API_KEY is not defined in environment variables.");
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `original-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limits
  fileFilter: (req, file, cb) => {
    const filetypes = /mp4|mov|avi|mkv|webm/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only video files (.mp4, .mov, .avi, .mkv, .webm) are allowed."));
  },
});

// In-Memory job tracking
interface JobLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface JobState {
  id: string;
  targetLanguage: string;
  languageLabel: string;
  originalFilename: string;
  stage: "idle" | "uploading" | "gemini_translating" | "heygen_processing" | "rendering" | "completed" | "failed";
  progress: number;
  statusText: string;
  originalPath: string;
  publicOriginalUrl: string;
  translatedScript?: string;
  videoUrl?: string;
  error?: string;
  logs: JobLog[];
  createdAt: number;
}

const jobs = new Map<string, JobState>();

function addLog(jobId: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  const job = jobs.get(jobId);
  if (job) {
    const timestamp = new Date().toLocaleTimeString();
    job.logs.push({ timestamp, message, type });
    console.log(`[Job ${jobId}] [${type.toUpperCase()}] ${message}`);
  }
}

// Clean up old jobs periodically (older than 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 2 * 60 * 60 * 1000) {
      // Delete local uploaded file as well to conserve space
      try {
        if (fs.existsSync(job.originalPath)) {
          fs.unlinkSync(job.originalPath);
        }
      } catch (e) {
        console.error("Failed to delete file for stale job:", e);
      }
      jobs.delete(id);
    }
  }
}, 30 * 60 * 1000);

// Language config mapping
const LANGUAGE_CONFIGS: Record<string, { name: string; style: string; heygenLang: string; heygenV3Code: string; videoUrl: string }> = {
  tamil: {
    name: "Tamil",
    style: "Tanglish (Tamil + colloquial English spoken casually on Chennai streets, blending terms smoothly)",
    heygenLang: "Tamil (India)",
    heygenV3Code: "ta",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-next-to-a-laptop-42171-large.mp4",
  },
  hindi: {
    name: "Hindi",
    style: "Hinglish (Hindi + English as spoken naturally in urban India, colloquial, casual, highly relatable)",
    heygenLang: "Hindi (India)",
    heygenV3Code: "hi",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-startup-team-working-on-a-creative-office-42111-large.mp4",
  },
  telugu: {
    name: "Telugu",
    style: "Telemix (Casual spoken Telugu heavily blended with everyday modern electronic & collegiate English terms)",
    heygenLang: "Telugu (India)",
    heygenV3Code: "te",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-coffee-shop-41829-large.mp4",
  },
  malayalam: {
    name: "Malayalam",
    style: "Manglish (Casual Malayalam seamlessly fused with conversational English terms as used by youth and media today)",
    heygenLang: "Malayalam (India)",
    heygenV3Code: "ml",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-working-on-her-laptop-in-bed-41864-large.mp4",
  },
  kannada: {
    name: "Kannada",
    style: "Kanglish (Kannada + colloquial English spoken casually on Bengaluru streets, blending technical terms and local slang)",
    heygenLang: "Kannada (India)",
    heygenV3Code: "kn",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-coffee-shop-41829-large.mp4",
  },
  tulu: {
    name: "Tulu",
    style: "Tulunglish (Tulu + English conversational blend as spoken around coastal Karnataka/Mangaluru, very warm and friendly)",
    heygenLang: "Kannada (India)",
    heygenV3Code: "kn",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-next-to-a-laptop-42171-large.mp4",
  },
  bengali: {
    name: "Bengali",
    style: "Bonglish (Bengali + conversational English spoken casually on Kolkata streets, rhythmic and friendly)",
    heygenLang: "Bengali (India)",
    heygenV3Code: "bn",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-startup-team-working-on-a-creative-office-42111-large.mp4",
  },
  marathi: {
    name: "Marathi",
    style: "Marathinglish (Marathi + English spoken natively in Mumbai, high-energy colloquial street style)",
    heygenLang: "Marathi (India)",
    heygenV3Code: "mr",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-working-on-her-laptop-in-bed-41864-large.mp4",
  },
  gujarati: {
    name: "Gujarati",
    style: "Gujlish (Gujarati + English blend spoken across urban business hubs of Gujarat, entrepreneurial and active)",
    heygenLang: "Gujarati (India)",
    heygenV3Code: "gu",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-coffee-shop-41829-large.mp4",
  },
  punjabi: {
    name: "Punjabi",
    style: "Punglish (Punjabi + English spoken with rich high-cadence street energy, vibrant and bold)",
    heygenLang: "Punjabi (India)",
    heygenV3Code: "pa",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-startup-team-working-on-a-creative-office-42111-large.mp4",
  },
};

// 1. Trigger Video processing
app.post("/api/process-video", async (req, res) => {
  try {
    const { videoUrl, targetLanguage } = req.body;

    if (!videoUrl) {
      res.status(400).json({ error: "Missing required parameter: videoUrl" });
      return;
    }

    if (!targetLanguage || !LANGUAGE_CONFIGS[targetLanguage]) {
      res.status(400).json({ error: `Invalid or missing target language. Must be one of: ${Object.keys(LANGUAGE_CONFIGS).join(", ")}` });
      return;
    }

    const jobId = Math.random().toString(36).substring(2, 15);
    const langCfg = LANGUAGE_CONFIGS[targetLanguage];

    const newJob: JobState = {
      id: jobId,
      targetLanguage,
      languageLabel: langCfg.name,
      originalFilename: videoUrl,
      stage: "gemini_translating",
      progress: 10,
      statusText: "Initializing localized translation analysis on the cloud...",
      originalPath: "",
      publicOriginalUrl: videoUrl,
      logs: [],
      createdAt: Date.now(),
    };

    jobs.set(jobId, newJob);
    addLog(jobId, "🚀 Initiated cloud video localization pipeline using public link.", "info");
    addLog(jobId, `🔗 target link submitted: ${videoUrl}`, "info");
    addLog(jobId, `🌐 Configured target tone dialect: ${langCfg.name} (${langCfg.style})`, "success");

    // Execute background orchestrator safely
    runVideoPipeline(jobId, videoUrl, targetLanguage).catch((err) => {
      console.error(`Error in video pipeline background thread for job [${jobId}]:`, err);
    });

    res.json({ jobId, status: "pending" });
  } catch (error: any) {
    console.error("Cloud processing exception:", error);
    res.status(500).json({ error: error.message || "Failed to initiate cloud video translation scheduler." });
  }
});

// 2. Fetch local orchestration Job status
app.get("/api/job-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Orchestration Job not found." });
    return;
  }
  res.json({
    jobId: job.id,
    stage: job.stage,
    progress: job.progress,
    statusText: job.statusText,
    translatedScript: job.translatedScript,
    videoUrl: job.videoUrl,
    languageLabel: job.languageLabel,
    originalFilename: job.originalFilename,
    publicOriginalUrl: job.publicOriginalUrl,
    error: job.error,
    logs: job.logs,
  });
});

// 3. Companion Status Check GET Route for HeyGen V3 specifically
app.get("/api/check-status/:id", async (req, res) => {
  const { id } = req.params;
  const heygenApiKey = process.env.HEYGEN_API_KEY || "";

  if (!heygenApiKey) {
    // Under sandbox mock mode, proxy search from simulated jobs Map, or fallback to successful mocks
    const job = jobs.get(id);
    if (job) {
      res.json({
        id,
        status: job.stage === "completed" ? "completed" : job.stage === "failed" ? "failed" : "running",
        url: job.videoUrl || null,
        error: job.error || null,
      });
      return;
    }
    // General fallback
    res.json({
      id,
      status: "completed",
      url: "https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-next-to-a-laptop-42171-large.mp4",
      error: null,
    });
    return;
  }

  try {
    const response = await fetch(`https://api.heygen.com/v3/video-translations/${id}`, {
      method: "GET",
      headers: {
        "X-Api-Key": heygenApiKey,
      },
    });

    if (!response.ok) {
      const errorContent = await response.text();
      res.status(response.status).json({ error: `HeyGen status query failed: ${errorContent || response.statusText}` });
      return;
    }

    const hgData = await response.json();
    const data = hgData.data || hgData;
    const status = data.status || "pending";
    const url = data.url || data.translated_video_url || null;
    const error = data.error || null;

    res.json({ id, status, url, error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch status from HeyGen." });
  }
});

// API configuration diagnostic check route
app.get("/api/config-check", (req, res) => {
  res.json({
    hasGemini: !!process.env.GEMINI_API_KEY,
    hasHeyGen: !!process.env.HEYGEN_API_KEY,
    appUrl: process.env.APP_URL || "Not specified (fallback to localhost)",
  });
});

// Main async runner for job
async function runVideoPipeline(jobId: string, videoUrl: string, targetLanguage: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  const langCfg = LANGUAGE_CONFIGS[targetLanguage];

  try {
    job.stage = "gemini_translating";
    job.progress = 25;
    job.statusText = "Gemini is analyzing the audio of the submitted URL...";
    addLog(jobId, "📡 Connecting with Gemini API for zero-footprint web link analysis...", "info");

    if (!process.env.GEMINI_API_KEY || !ai) {
      throw new Error("Missing GEMINI_API_KEY in environment variables. Please check Secrets panel.");
    }

    const promptMessage = `Analyze the audio track of the video located at this URL: "${videoUrl}".
Transcribe the core script, then translate it into the requested target language: "${langCfg.name}".

Crucial Linguistic Rule: 
Do NOT use a formal, old-fashioned, or bookish translation. Write it exactly how a casual, modern person would speak to a friend on the streets of India or on social media today. Blends other English keywords fluidly.
Specifically, make sure to generate it in the colloquial style of: "${langCfg.style}".

Return ONLY the clean, translated script text and absolutely nothing else (no timestamps, meta annotations, speaker headers, explanation paragraphs, or introduction labels). Just output the fluentTranslatedScript.`;

    addLog(jobId, `📖 Prompting model ('gemini-3.5-flash') to perform conversational script trans-creation...`, "info");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
    });

    const translatedText = response.text?.trim() || "";
    if (!translatedText) {
      throw new Error("Gemini returned an empty conversational translation transcript.");
    }

    job.translatedScript = translatedText;
    addLog(jobId, `✨ Gemini successfully localized original script audio to ${langCfg.name}!`, "success");
    addLog(jobId, `📝 Script result:\n"${translatedText}"`, "info");

    // Stage 3: HeyGen Processing Lip-Sync
    job.stage = "heygen_processing";
    job.progress = 65;
    job.statusText = "Engaging HeyGen v3 multi-lingual lip-sync dubbing clusters...";

    const heygenApiKey = process.env.HEYGEN_API_KEY || "";
    if (!heygenApiKey) {
      addLog(jobId, "⚠️ HEYGEN_API_KEY is not defined. Initiating High-Fidelity Simulation Sandbox...", "warning");
      addLog(jobId, "💡 Info: To run live with your HeyGen account, supply your API key under Settings > Secrets.", "info");

      // Sandbox Mocking workflow
      addLog(jobId, `[SANDBOX] Compiling HeyGen v3 Video Translation payload...`, "info");
      const mockPayload = {
        video: {
          type: "url",
          url: videoUrl,
        },
        output_languages: [langCfg.heygenV3Code],
        mode: "precision",
        custom_translation: [
          {
            output_language: langCfg.heygenV3Code,
            translation: [
              {
                translation: translatedText,
              },
            ],
          },
        ],
      };
      addLog(jobId, `[SANDBOX] Dispatching payload to: POST https://api.heygen.com/v3/video-translations`, "info");
      addLog(jobId, `[SANDBOX] Structured Body: ${JSON.stringify(mockPayload, null, 2)}`, "info");

      await new Promise(r => setTimeout(r, 4000));
      addLog(jobId, "[SANDBOX] Connection acknowledged. ID generated: 'trans_v3_sim_98a7c2e'", "success");

      job.stage = "rendering";
      job.progress = 85;
      job.statusText = "[SANDBOX] Simulating background lip-sync facial rendering in progress...";
      addLog(jobId, "[SANDBOX] Polling HeyGen translation status: 'running' (40% complete)", "info");

      await new Promise(r => setTimeout(r, 3000));
      addLog(jobId, "[SANDBOX] Polling HeyGen translation status: 'running' (80% complete)", "info");

      await new Promise(r => setTimeout(r, 3000));
      addLog(jobId, "[SANDBOX] Polling finished! Status: 'completed'. Outputs finalized.", "success");

      job.videoUrl = langCfg.videoUrl;
      job.stage = "completed";
      job.progress = 100;
      job.statusText = "Synthesis finalized! Video dubbed inside simulated Sandbox Playground.";
      addLog(jobId, "🎉 Video Localization complete!", "success");
    } else {
      // Real HeyGen v3 Video Translation API
      addLog(jobId, "📡 Assembling custom translation parameters for HeyGen v3...", "info");

      const payload = {
        video: {
          type: "url",
          url: videoUrl,
        },
        output_languages: [langCfg.heygenV3Code],
        mode: "precision",
        custom_translation: [
          {
            output_language: langCfg.heygenV3Code,
            translation: [
              {
                translation: translatedText,
              },
            ],
          },
        ],
      };

      addLog(jobId, "🚀 Dispatching asynchronous pipeline request to HeyGen v3 Video Translation...", "info");

      const hgResponse = await fetch("https://api.heygen.com/v3/video-translations", {
        method: "POST",
        headers: {
          "X-Api-Key": heygenApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!hgResponse.ok) {
        const errDetails = await hgResponse.text();
        throw new Error(`HeyGen V3 API failed (Status ${hgResponse.status}): ${errDetails || hgResponse.statusText}`);
      }

      const hgResponseParsed = await hgResponse.json();
      const heygenJobId = hgResponseParsed?.data?.video_translation_id || hgResponseParsed?.video_translation_id || hgResponseParsed?.data?.id || hgResponseParsed?.id;

      if (!heygenJobId) {
        throw new Error(`Failed to extract a valid video_translation_id from HeyGen's response: ${JSON.stringify(hgResponseParsed)}`);
      }

      addLog(jobId, `✅ HeyGen v3 successfully initialized background render. Handshake ID: ${heygenJobId}`, "success");

      job.stage = "rendering";
      job.progress = 80;
      job.statusText = "HeyGen visual lip rendering & vocal replication in progress...";

      let rendered = false;
      let checkAttempts = 0;
      let finalVideoUrl = "";

      // Background poll using step 4 logic
      while (!rendered && checkAttempts < 60) {
        checkAttempts++;
        await new Promise(r => setTimeout(r, 6000));
        addLog(jobId, `Checking HeyGen rendering updates (Check #${checkAttempts}/60)...`, "info");

        const checkResponse = await fetch(`https://api.heygen.com/v3/video-translations/${heygenJobId}`, {
          method: "GET",
          headers: {
            "X-Api-Key": heygenApiKey,
          },
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const data = checkData.data || checkData;
          const targetStatus = data.status || "pending";

          addLog(jobId, `Status received: "${targetStatus}"`, "info");

          if (targetStatus === "success" || targetStatus === "completed" || targetStatus === "done") {
            finalVideoUrl = data.url || data.translated_video_url;
            rendered = true;
            break;
          } else if (targetStatus === "failed") {
            throw new Error(`HeyGen's rendering script reported a fatal execution failure: ${data.error || "Unknown error details"}`);
          }
        } else {
          addLog(jobId, `Warning: Status check returned Code ${checkResponse.status}. Retrying...`, "warning");
        }
      }

      if (!rendered || !finalVideoUrl) {
        throw new Error("HeyGen v3 translation rendering timed out or completed without a download URL.");
      }

      job.videoUrl = finalVideoUrl;
      job.stage = "completed";
      job.progress = 100;
      job.statusText = "Synthesis finished successfully! Locally-dubbed lips synced.";
      addLog(jobId, "🎉 Video localized, dubbed, and lip-synced beautifully via HeyGen v3 API!", "success");
    }
  } catch (error: any) {
    console.error(`Orchestration failed for job ${jobId}:`, error);
    job.stage = "failed";
    job.error = error.message || "An unexpected error disrupted the video localization workflow.";
    job.statusText = `Error encountered: ${job.error}`;
    addLog(jobId, `💥 PROCESS FATAL CRASH: ${job.error}`, "error");
  }
}

// Complete express dev integration
async function run() {
  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Server Middleware setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
  } else {
    // Static production build distribution
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static production build server configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Dedicated video orchestrator active on: http://localhost:${PORT}`);
  });
}

run();
