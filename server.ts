import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Make dist/server.cjs compatible (esbuild outputs CommonJS). In CJS, import.meta.url is undefined,
// so we fall back to process.cwd().
const safeImportMetaUrl: string | undefined =
  typeof import.meta !== "undefined" && (import.meta as any)?.url
    ? (import.meta as any).url
    : undefined;

import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

import jwt from "jsonwebtoken";
import multer from "multer";
import pdfParse from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import { db } from "./src/server/db";
import {
  User,
  PDFDocument,
  PDFChunk,
  ChatSession,
  ChatMessage,
} from "./src/types";
import { handleStaticQA } from "./src/server/assistantStaticQA";

// Redirect logs to server.log so we can debug errors instantly
const logFile = process.env.VERCEL
  ? path.join("/tmp", "server.log")
  : path.join(process.cwd(), "server.log");
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  try {
    fs.appendFileSync(
      logFile,
      args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ") + "\n",
    );
  } catch (e) {}
};
console.error = (...args) => {
  originalError(...args);
  try {
    fs.appendFileSync(
      logFile,
      "[ERROR] " +
        args
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
          .join(" ") +
        "\n",
    );
  } catch (e) {}
};

const __filename = safeImportMetaUrl
  ? fileURLToPath(safeImportMetaUrl)
  : path.join(process.cwd(), "server.ts");
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "documind_ai_secret_encryption_key_2026";

// Lazy initialize GoogleGenAI client (secures startup in case key is missing)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    // Support common dotenv/host configurations: accept plain value already placed in GEMINI_API_KEY.
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY context environment variable is required for AI capabilities.",
      );
    }

    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Custom Recursive Character-style Text Splitter
function splitText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150,
): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const cleanedParagraph = paragraph.replace(/\s+/g, " ").trim();
    if (!cleanedParagraph) continue;

    if ((currentChunk + " " + cleanedParagraph).length <= chunkSize) {
      currentChunk += (currentChunk ? " " : "") + cleanedParagraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Retain overlap words
        const words = currentChunk.split(" ");
        let overlapText = "";
        for (let i = words.length - 1; i >= 0; i--) {
          if ((words[i] + " " + overlapText).length <= overlap) {
            overlapText = words[i] + (overlapText ? " " : "") + overlapText;
          } else {
            break;
          }
        }
        currentChunk = overlapText;
      }

      // If single paragraph exceeds max chunk size, divide logically by sentences
      if (cleanedParagraph.length > chunkSize) {
        const sentences = cleanedParagraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if ((currentChunk + " " + sentence).length <= chunkSize) {
            currentChunk += (currentChunk ? " " : "") + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk += (currentChunk ? " " : "") + cleanedParagraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter((c) => c.trim().length > 10);
}

// Global retry helper to heal transient network glitches and 429 rate limits dynamically
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 4,
  delay = 1000,
  factor = 2,
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit =
      error.status === 429 ||
      String(error.message || "").includes("429") ||
      String(error.message || "")
        .toLowerCase()
        .includes("quota") ||
      error.status === 503 ||
      String(error.message || "").includes("503");
    if (retries > 0 && isRateLimit) {
      console.warn(
        `[RETRY BACKOFF] Rate limit or transient error hit. Retrying in ${delay}ms... Details:`,
        error.message || error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * factor, factor);
    }
    throw error;
  }
}

// Express initialization
const app = express();
app.use(express.json({ limit: "10mb" }));

// Ensure malformed JSON bodies always return JSON (prevents HTML/empty responses causing generic UI errors)
app.use((err: any, req: any, res: any, next: any) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  return next(err);
});

// Setup file upload directories
const uploadsDir = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.error(
    "[CRITICAL] Failed to ensure uploadsDir exists, proceeding safely:",
    e,
  );
}

// Multer Storage Configuration (using memoryStorage prevents filesystem bottlenecks and write permission issues on Cloud Run)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are supported!"));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max limit
  },
});

// Authentication middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader &&
    (authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader);

  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Token is invalid or expired" });
    }
    req.user = decoded;
    next();
  });
}

// --- API ROUTES ---

// Auth Register
app.post("/api/auth/register", async (req, res) => {
  try {
    // Local debug: helps confirm body parsing / payload shape
    if (!process.env.VERCEL) {
      console.log("[AUTH][REGISTER] received:", {
        hasBody: !!req?.body,
        hasName: !!req?.body?.name,
        hasEmail: !!req?.body?.email,
        hasPassword: !!req?.body?.password,
        email: req?.body?.email ? String(req.body.email) : undefined,
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "All fields (name, email, password) are required" });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email address is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id =
      Date.now().toString() + Math.round(Math.random() * 1000).toString();

    const newUser: any = {
      id,
      name,
      email,
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
      promptCount: 0,
      tier: "free",
      paymentStatus: "none",
      paymentPlanRequested: null,
      paymentTxId: null,
      paymentDate: null,
    };

    db.createUser(newUser);

    // Generate token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
        promptCount: 0,
        tier: "free",
        paymentStatus: "none",
        paymentPlanRequested: null,
        paymentTxId: null,
        paymentDate: null,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Auth Login
app.post("/api/auth/login", async (req, res) => {
  try {
    // Local debug: helps confirm body parsing / payload shape
    if (!process.env.VERCEL) {
      console.log("[AUTH][LOGIN] received:", {
        hasBody: !!req?.body,
        hasEmail: !!req?.body?.email,
        hasPassword: !!req?.body?.password,
        email: req?.body?.email ? String(req.body.email) : undefined,
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Dynamic admin reinforcement & direct robust login bypass
    const checkEmail = (email || "").toLowerCase().trim();
    const checkPassword = (password || "").trim();

    if (
      checkEmail === "kmulatu21@gmail.com" &&
      checkPassword === "admin@docmind"
    ) {
      let existing = db.getUserByEmail("kmulatu21@gmail.com");
      const hashedPassword = await bcrypt.hash("admin@docmind", 10);
      if (!existing) {
        existing = db.createUser({
          id: `usr-${Date.now()}`,
          name: "Kmulatu Admin",
          email: "kmulatu21@gmail.com",
          password: hashedPassword,
          role: "admin",
          createdAt: new Date().toISOString(),
          promptCount: 0,
          tier: "premium",
          paymentStatus: "approved",
        });
        console.log(
          "Interception: dynamically created kmulatu21@gmail.com administrator account",
        );
      } else {
        // Double check existing fields are correct
        if (
          existing.role !== "admin" ||
          existing.tier !== "premium" ||
          !(await bcrypt.compare("admin@docmind", existing.password))
        ) {
          existing = db.updateUser({
            id: existing.id,
            role: "admin",
            tier: "premium",
            paymentStatus: "approved",
            password: hashedPassword,
          });
          console.log(
            "Interception: dynamically corrected kmulatu21@gmail.com admin credentials and role",
          );
        }
      }

      // Generate token and return session immediately! This guarantees flawless 100% login success.
      const token = jwt.sign(
        { id: existing.id, email: existing.email, role: existing.role },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      return res.json({
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          createdAt: existing.createdAt,
          promptCount: existing.promptCount || 0,
          tier: existing.tier || "premium",
          paymentStatus: existing.paymentStatus || "approved",
          paymentPlanRequested: existing.paymentPlanRequested || null,
          paymentTxId: existing.paymentTxId || null,
          paymentDate: existing.paymentDate || null,
        },
        token,
      });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        promptCount: user.promptCount || 0,
        tier: user.tier || "free",
        paymentStatus: user.paymentStatus || "none",
        paymentPlanRequested: user.paymentPlanRequested || null,
        paymentTxId: user.paymentTxId || null,
        paymentDate: user.paymentDate || null,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Auth get profile
app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  try {
    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      promptCount: user.promptCount || 0,
      tier: user.tier || "free",
      paymentStatus: user.paymentStatus || "none",
      paymentPlanRequested: user.paymentPlanRequested || null,
      paymentTxId: user.paymentTxId || null,
      paymentDate: user.paymentDate || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PDF List Uploads
app.get("/api/pdf", authenticateToken, (req: any, res) => {
  try {
    const pdfs = db.getPDFsByUser(req.user.id);
    res.json(pdfs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Robust, unified PDF document parsing and vector chunk embedding mapping pipeline
async function processPDFBuffer(
  userId: string,
  originalname: string,
  fileBuffer: Buffer,
): Promise<PDFDocument> {
  const ai = getGeminiClient();
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error(
      `Uploaded file ${originalname} is empty or has binary stream issues.`,
    );
  }

  const pdfId =
    Date.now().toString() + Math.round(Math.random() * 1000).toString();
  const safeStoreName = `${pdfId}-${originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const filePath = path.join(uploadsDir, safeStoreName);

  // Store the PDF permanently on disk
  fs.writeFileSync(filePath, fileBuffer);

  // Parse content page-by-page using custom pagerender callback
  const pageTexts: { pageNum: number; text: string }[] = [];
  let pdfData: any;

  try {
    pdfData = await pdfParse(fileBuffer, {
      pagerender: function (pageData: any) {
        try {
          return pageData
            .getTextContent()
            .then(function (textContent: any) {
              let lastY: number | undefined,
                text = "";
              if (textContent && Array.isArray(textContent.items)) {
                for (const item of textContent.items) {
                  if (!item) continue;
                  const hasTransform =
                    Array.isArray(item.transform) && item.transform.length >= 6;
                  const itemY = hasTransform ? item.transform[5] : undefined;

                  if (lastY === undefined || lastY === itemY) {
                    text += item.str || "";
                  } else {
                    text += "\n" + (item.str || "");
                  }
                  if (itemY !== undefined) {
                    lastY = itemY;
                  }
                }
              }
              const pageNum =
                pageData.pageNumber || pageData.pageIndex + 1 || 1;
              pageTexts.push({ pageNum, text });
              return text;
            })
            .catch((e: any) => {
              console.error("Promise rejection in PDF pagerender callback:", e);
              return "";
            });
        } catch (err) {
          console.error("Synchronous inner error inside PDF pagerender:", err);
          return Promise.resolve("");
        }
      },
    });
  } catch (parseError: any) {
    console.warn(
      `Robust PDF custom pagerender failed, falling back to standard pdfParse:`,
      parseError,
    );
    try {
      pdfData = await pdfParse(fileBuffer);
    } catch (fallbackParseError: any) {
      throw new Error(
        `Failed to read PDF file format: ${fallbackParseError.message || fallbackParseError}`,
      );
    }
  }

  const pageCount = pdfData.numpages || pageTexts.length || 1;

  // Create PDF record referencing physical filePath on disk
  const pdfInfo: PDFDocument = {
    id: pdfId,
    userId: userId,
    fileName: originalname,
    filePath,
    fileSize: fileBuffer.length,
    pageCount,
    uploadDate: new Date().toISOString(),
  };

  // Extract chunks and index them page by page
  const generatedChunks: PDFChunk[] = [];
  let globalChunkIdx = 0;

  const chunksToEmbed: { text: string; pageNum: number }[] = [];

  if (pageTexts.length > 0) {
    for (const page of pageTexts) {
      if (!page.text || page.text.trim().length <= 5) continue;
      const pageChunks = splitText(page.text, 800, 150);
      for (const text of pageChunks) {
        chunksToEmbed.push({ text, pageNum: page.pageNum });
      }
    }
  } else {
    // Fallback for full textual extraction
    const extractedText = pdfData.text || "";
    const textChunks = splitText(extractedText);
    for (const text of textChunks) {
      chunksToEmbed.push({ text, pageNum: 1 });
    }
  }

  // Embed chunks with concurrency pooling and automatic exponential backoff retry to avoid rate limits
  if (chunksToEmbed.length > 0) {
    const results: any[] = [];
    const concurrencyLimit = 3; // safe level for both standard and lower-tier keys

    for (let i = 0; i < chunksToEmbed.length; i += concurrencyLimit) {
      const batch = chunksToEmbed.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (item) => {
        return await retryWithBackoff(async () => {
          let values: number[] | null = null;

          // Try GA general modern embedding model first
          try {
            const embedRes = await ai.models.embedContent({
              model: "gemini-embedding-2",
              contents: item.text,
            });
            const anyRes = embedRes as any;
            values = anyRes.embedding?.values || anyRes.embeddings?.[0]?.values;
          } catch (embedError: any) {
            console.warn(
              `[UPLOAD] Primary embedding 'gemini-embedding-2' failed, seeking fallback preview model. Reason:`,
              embedError?.message || embedError,
            );

            // Fallback 1: gemini-embedding-2-preview
            try {
              const fallbackRes = await ai.models.embedContent({
                model: "gemini-embedding-2-preview",
                contents: item.text,
              });
              const anyRes = fallbackRes as any;
              values =
                anyRes.embedding?.values || anyRes.embeddings?.[0]?.values;
            } catch (previewError: any) {
              console.warn(
                `[UPLOAD] Fallback 'gemini-embedding-2-preview' failed, seeking legacy fallback. Reason:`,
                previewError?.message || previewError,
              );

              // Fallback 2: gemini-embedding-001 (extremely robust legacy base)
              const legacyRes = await ai.models.embedContent({
                model: "gemini-embedding-001",
                contents: item.text,
              });
              const anyRes = legacyRes as any;
              values =
                anyRes.embedding?.values || anyRes.embeddings?.[0]?.values;
            }
          }

          if (values && values.length > 0) {
            return {
              text: item.text,
              embedding: values,
              pageNum: item.pageNum,
            };
          }
          return null;
        });
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small resting period to yield execution and remain under API rate intervals
      if (i + concurrencyLimit < chunksToEmbed.length) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    for (const result of results) {
      if (result) {
        generatedChunks.push({
          id: `${pdfId}-chunk-${globalChunkIdx++}`,
          pdfId,
          userId: userId,
          text: result.text,
          embedding: result.embedding,
          pageNum: result.pageNum,
        });
      }
    }
  }

  // Store in DB
  db.savePDF(pdfInfo);
  if (generatedChunks.length > 0) {
    db.saveChunks(generatedChunks);
  }
  return pdfInfo;
}

// PDF Upload & Process (Standard Direct Endpoint)
app.post(
  "/api/pdf/upload",
  authenticateToken,
  upload.array("files"),
  async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files were uploaded" });
      }

      const user = db.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userPdfs = db.getPDFsByUser(req.user.id);
      const existingCount = userPdfs.length;
      const tier = user.tier || "free";

      let maxAllowed = 1; // Free and Basic get max 1 PDF
      if (tier === "pro") {
        maxAllowed = 2; // Pro gets max 2 PDFs
      } else if (tier === "premium") {
        maxAllowed = 999; // Premium allows 3 or more (essentially unlimited)
      }

      if (existingCount + files.length > maxAllowed) {
        return res.status(400).json({
          error: "PDF vault limit reached",
          tier,
          currentCount: existingCount,
          maxAllowed,
          message: `Your active ${tier.toUpperCase()} Plan allows a maximum of ${maxAllowed} PDF upload(s). Upgrade your tier to upload more files.`,
        });
      }

      // Verify Gemini API key is configured
      try {
        getGeminiClient();
      } catch (e: any) {
        return res.status(503).json({
          error:
            "Gemini API key is missing. Please set GEMINI_API_KEY in the Secrets panel.",
        });
      }

      const processedDocs: PDFDocument[] = [];

      // Helper for sequential async PDF parsing & embedding
      for (const file of files) {
        const pdfInfo = await processPDFBuffer(
          req.user.id,
          file.originalname,
          file.buffer,
        );
        processedDocs.push(pdfInfo);
      }

      res.status(201).json(processedDocs);
    } catch (error: any) {
      console.error("Error in upload controller:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to process document uploads" });
    }
  },
);

// PDF Upload Chunk Route (Stores independent chunks in temporary slice buffers to bypass Nginx limitations)
app.post(
  "/api/pdf/upload-chunk",
  authenticateToken,
  upload.single("chunk"),
  async (req: any, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks } = req.body;
      if (!uploadId || chunkIndex === undefined || !totalChunks) {
        return res.status(400).json({
          error:
            "Missing required chunk metadata: uploadId, chunkIndex, totalChunks",
        });
      }

      const user = db.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Proactive quota check inside the upload chunk route
      const userPdfs = db.getPDFsByUser(req.user.id);
      const existingCount = userPdfs.length;
      const tier = user.tier || "free";

      let maxAllowed = 1; // Free and Basic get max 1 PDF
      if (tier === "pro") {
        maxAllowed = 2; // Pro gets max 2 PDFs
      } else if (tier === "premium") {
        maxAllowed = 999; // Premium allows virtually unlimited
      }

      if (existingCount + 1 > maxAllowed) {
        return res.status(400).json({
          error: "PDF vault limit reached",
          tier,
          currentCount: existingCount,
          maxAllowed,
          message: `Your active ${tier.toUpperCase()} Plan allows a maximum of ${maxAllowed} PDF upload(s). Upgrade your tier to upload more files.`,
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No chunk file was uploaded" });
      }

      const chunkDir = path.join(uploadsDir, `chunks-${uploadId}`);
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
      }

      const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
      fs.writeFileSync(chunkPath, req.file.buffer);

      res.json({ success: true, chunkIndex: parseInt(chunkIndex, 10) });
    } catch (err: any) {
      console.error("Error in PDF chunk upload:", err);
      res.status(500).json({ error: err.message || "Chunk upload failed" });
    }
  },
);

// PDF Assemble Route (Concatenates sequential chunks and processes the full PDF buffer without body-size limits)
app.post("/api/pdf/assemble", authenticateToken, async (req: any, res) => {
  try {
    const { uploadId, filename, totalChunks } = req.body;
    if (!uploadId || !filename || !totalChunks) {
      return res.status(400).json({
        error:
          "Missing required assembly metadata: uploadId, filename, totalChunks",
      });
    }

    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify user can upload another PDF
    const userPdfs = db.getPDFsByUser(req.user.id);
    const existingCount = userPdfs.length;
    const tier = user.tier || "free";

    let maxAllowed = 1; // Free and Basic get max 1 PDF
    if (tier === "pro") {
      maxAllowed = 2; // Pro gets max 2 PDFs
    } else if (tier === "premium") {
      maxAllowed = 999; // Premium allows 3 or more (essentially unlimited)
    }

    if (existingCount + 1 > maxAllowed) {
      return res.status(400).json({
        error: "PDF vault limit reached",
        tier,
        currentCount: existingCount,
        maxAllowed,
        message: `Your active ${tier.toUpperCase()} Plan allows a maximum of ${maxAllowed} PDF upload(s). Upgrade your tier to upload more files.`,
      });
    }

    // Verify Gemini API key is configured
    try {
      getGeminiClient();
    } catch (e: any) {
      return res.status(503).json({
        error:
          "Gemini API key is missing. Please set GEMINI_API_KEY in the Secrets panel.",
      });
    }

    const chunkDir = path.join(uploadsDir, `chunks-${uploadId}`);
    if (!fs.existsSync(chunkDir)) {
      return res
        .status(404)
        .json({ error: "Upload transaction chunk directory not found" });
    }

    // Verify all chunks are present and concatenate them sequentially
    const chunkBuffers: Buffer[] = [];
    const total = parseInt(totalChunks, 10);
    for (let idx = 0; idx < total; idx++) {
      const chunkPath = path.join(chunkDir, `chunk-${idx}`);
      if (!fs.existsSync(chunkPath)) {
        return res
          .status(400)
          .json({ error: `Missing chunk at index ${idx}. Please re-upload.` });
      }
      chunkBuffers.push(fs.readFileSync(chunkPath));
    }

    const fullFileBuffer = Buffer.concat(chunkBuffers);

    // Call unified processor to parse format and map vector chunks
    const pdfInfo = await processPDFBuffer(
      req.user.id,
      filename,
      fullFileBuffer,
    );

    // Clean up temporary chunk folder
    try {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(
        `[ASSEMBLE] Failed to remove slice chunks temp directory ${chunkDir}:`,
        cleanupErr,
      );
    }

    res.status(201).json([pdfInfo]);
  } catch (error: any) {
    console.error("Error in PDF assemble controller:", error);
    res.status(500).json({
      error: error.message || "Failed to assemble and process PDF chunks",
    });
  }
});

// PDF Delete
app.delete("/api/pdf/:id", authenticateToken, (req: any, res) => {
  try {
    const success = db.deletePDF(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: "PDF not found or unauthorized" });
    }
    res.json({
      message: "Document and processed knowledge successfully deleted",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Chat Sessions List
app.get("/api/chats", authenticateToken, (req: any, res) => {
  try {
    const sessions = db.getChatSessions(req.user.id);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Chat Session
app.post("/api/chats", authenticateToken, (req: any, res) => {
  try {
    const { title } = req.body;
    const session: ChatSession = {
      id: Date.now().toString() + Math.round(Math.random() * 1000).toString(),
      userId: req.user.id,
      title: title || "New PDF Inquiry",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    db.saveChatSession(session);
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Chat Session
app.delete("/api/chats/:id", authenticateToken, (req: any, res) => {
  try {
    const success = db.deleteChatSession(req.params.id, req.user.id);
    if (!success) {
      return res
        .status(404)
        .json({ error: "Chat session not found or unauthorized" });
    }
    res.json({ message: "Chat history cleared" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Query & Q&A RAG Retrieval
app.post(
  "/api/chats/:id/message",
  authenticateToken,
  upload.single("questionFile"),
  async (req: any, res) => {
    try {
      const { message } = req.body;
      const sessionId = req.params.id;

      if ((!message || message.trim() === "") && !req.file) {
        return res.status(400).json({
          error: "Query message or questions file upload is required",
        });
      }

      const user = db.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const promptCount = user.promptCount || 0;
      const tier = user.tier || "free";
      const paymentStatus = user.paymentStatus || "none";

      if (tier === "free") {
        const userPdfsCount = db.getPDFsByUser(req.user.id).length;
        if (promptCount >= 5 || userPdfsCount >= 1) {
          return res.status(400).json({
            error: "Free credit limit reached or document limit reached",
            promptLimitReached: true,
            message:
              "Your free tier has completed. You have either hit the limit of 5 free prompt requests or indexed 1 PDF document. Please upgrade your plan to continue asking questions.",
          });
        }
      } else {
        // Basic, Pro, or Premium status checks:
        if (paymentStatus !== "approved") {
          return res.status(400).json({
            error: "Payment pending approval",
            paymentPendingApproval: true,
            message:
              "Your payment is being reviewed. The app will be unlocked as soon as an admin approves your transaction proof.",
          });
        }

        // Proactive prompt count caps for Basic & Pro
        if (tier === "basic" && promptCount >= 50) {
          return res.status(400).json({
            error: "Basic plan credit limit reached",
            promptLimitReached: true,
            message:
              "You have reached the limit of 50 prompts on your Basic plan. Please upgrade your plan to continue.",
          });
        }

        if (tier === "pro" && promptCount >= 50) {
          return res.status(400).json({
            error: "Pro plan credit limit reached",
            promptLimitReached: true,
            message:
              "You have reached the monthly limit of 50 prompts on your Pro plan. Please upgrade to Premium to continue.",
          });
        }
      }

      const session = db.getChatSession(sessionId, req.user.id);
      if (!session) {
        return res.status(404).json({ error: "Chat session not found" });
      }

      // Verify Gemini API Connection
      let ai;
      try {
        ai = getGeminiClient();
      } catch (e) {
        return res.status(503).json({
          error:
            "Gemini API key is not configured. Please use the Secrets panel to enter your GEMINI_API_KEY.",
        });
      }

      // Parse question PDF if attached
      let questionFileContext = "";
      let questionFileName = "";
      let displayUserMessage = message || "";

      if (req.file) {
        questionFileName = req.file.originalname;
        const qPageTexts: { pageNum: number; text: string }[] = [];
        try {
          const qPdfData = await pdfParse(req.file.buffer, {
            pagerender: function (pageData: any) {
              return pageData.getTextContent().then(function (
                textContent: any,
              ) {
                let lastY: number | undefined,
                  text = "";
                for (const item of textContent.items) {
                  if (lastY === undefined || lastY === item.transform[5]) {
                    text += item.str;
                  } else {
                    text += "\n" + item.str;
                  }
                  lastY = item.transform[5];
                }
                const pageNum =
                  pageData.pageNumber || pageData.pageIndex + 1 || 1;
                qPageTexts.push({ pageNum, text });
                return text;
              });
            },
          });

          if (qPageTexts.length > 0) {
            questionFileContext = qPageTexts
              .map(
                (qp) =>
                  `[UPLOADED QUESTIONS FILE: "${questionFileName}" - Page ${qp.pageNum}]:\n${qp.text}`,
              )
              .join("\n\n");
          } else {
            const fallbackText = qPdfData.text || "";
            questionFileContext = `[UPLOADED QUESTIONS FILE: "${questionFileName}" - Page 1]:\n${fallbackText}`;
          }
        } catch (parseErr: any) {
          console.error("Error parsing uploaded question file:", parseErr);
          questionFileContext = `[ERROR parsing uploaded questions file "${questionFileName}"]`;
        }

        const truncatedPromptLabel = message
          ? ` - "${message.substring(0, 30)}..."`
          : "";
        displayUserMessage = `📁 [Questions File: ${questionFileName}]${truncatedPromptLabel}`;
      }

      // Combine user message query with parts of question text for similarity embedding mapping
      let queryEmbeddingText = (message || "").trim();
      if (questionFileContext && queryEmbeddingText.length < 50) {
        queryEmbeddingText += " " + questionFileContext.substring(0, 1000);
      }
      if (!queryEmbeddingText) {
        queryEmbeddingText = "Questions and key facts summary";
      }

      // 1. Convert user's question into embedding
      let queryEmbedding: number[] = [];
      try {
        // Use retryWithBackoff and fallback model chain for query embedding to protect against transient/rate issues
        const embedRes = await retryWithBackoff(async () => {
          try {
            return await ai.models.embedContent({
              model: "gemini-embedding-2",
              contents: queryEmbeddingText,
            });
          } catch (err: any) {
            console.warn(
              `[QUERY] Primary embedding 'gemini-embedding-2' failed, trying preview. Reason:`,
              err?.message || err,
            );
            try {
              return await ai.models.embedContent({
                model: "gemini-embedding-2-preview",
                contents: queryEmbeddingText,
              });
            } catch (previewErr: any) {
              console.warn(
                `[QUERY] Preview embedding failed, trying legacy. Reason:`,
                previewErr?.message || previewErr,
              );
              return await ai.models.embedContent({
                model: "gemini-embedding-001",
                contents: queryEmbeddingText,
              });
            }
          }
        });

        const anyRes = embedRes as any;
        queryEmbedding =
          anyRes.embedding?.values || anyRes.embeddings?.[0]?.values || [];
      } catch (e: any) {
        return res
          .status(500)
          .json({ error: `Embedding generation failed: ${e.message}` });
      }

      // 2. Perform semantic search over user's PDF chunks using dot-product similarity
      const matches = db.searchSimilarChunks(req.user.id, queryEmbedding, 5);

      // 3. Compile contextual prompts
      let documentContext = "";
      const sources: {
        pdfId: string;
        fileName: string;
        text: string;
        pageNum?: number;
      }[] = [];

      matches.forEach((match, idx) => {
        const doc = db.getPDF(match.chunk.pdfId);
        const filename = doc ? doc.fileName : "Unknown Document";
        const pageNum = match.chunk.pageNum || 1;

        documentContext += `[Stored Reference Document ${idx + 1}: "${filename}" (Page ${pageNum})]:\n${match.chunk.text}\n\n`;

        // Store sources for backend tracking
        sources.push({
          pdfId: match.chunk.pdfId,
          fileName: filename,
          text: match.chunk.text,
          pageNum: pageNum,
        });
      });

      // 4. Construct AI System Instructions
      let systemPrompt = `You are DocuMind AI, an advanced AI-powered PDF Knowledge Assistant.
Your sole mission is to answer user inquiries strictly and accurately based on the text snippets retrieved from the user's uploaded stored documents.

`;

      if (questionFileContext) {
        systemPrompt += `QUESTIONS FILE ATTACHED BY USER:
The user has uploaded a PDF containing questions. Here are the pages and text content from the uploaded questions file:
${questionFileContext}

`;
      }

      systemPrompt += `CONTEXT FROM STORED REFERENCE DOCUMENTS:
${documentContext || "NO DOCUMENTS HAVE BEEN UPLOADED YET OR NO RELEVANT CONTEXT FOUND."}

RULES OF ENGAGEMENT:
- Try to give the correct, grounded answer based on the stored PDF file/files.
- Rely ONLY on the provided Context of Uploaded/Stored Documents above to formulate your response.
- DO NOT display any "RAG context citations" section or block under the final answer. Provide all citations and sources naturally inside the text.
- IMPORTANT: You MUST include the exact PDF name and page number of BOTH the question (from the uploaded questions file, e.g. "assignment.pdf", Page X) and the answer (from the stored reference PDF files, e.g. "textbook.pdf", Page Y) for each question/answer in your response.
  For example, format it like: "According to [Questions File Page X], the question asks... The answer can be found in [Reference File Page Y] which states..." or similar clear references.
- If the context matches are blank, or they do not contain facts to resolve the user's instruction, state clearly and humbly: "I cannot find the answer in the uploaded documents." Do not try to hypothesize or supply general knowledge answers.
- Format your response in clean, easy-to-read Markdown. Use headers, bullet points, numbered lists, or bold highlights as necessary to organize your points.`;

      // 5. Ask Gemini - using Chat interface context or Direct generateContent using history
      // Since we want context history, we map previous chats as messages in the contents list
      const promptContents: any[] = [];

      // Add brief history (last 6 messages) for conversational continuity
      const history = session.messages.slice(-6);
      history.forEach((m) => {
        promptContents.push({
          role: m.sender === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        });
      });

      // Add current user prompt
      const finalPromptText =
        message ||
        "Please answer the questions found in our attached questions file based on the reference documents.";
      promptContents.push({
        role: "user",
        parts: [{ text: finalPromptText }],
      });

      let aiResponseText = "";
      try {
        const genRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: promptContents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2, // Lower temperature keeps content strictly grounded
          },
        });

        aiResponseText =
          genRes.text || "I encountered an issue generating a grounded answer.";
      } catch (e: any) {
        aiResponseText = `AI Retrieval Error: ${e.message || "Unknown generation failure"}`;
      }

      // Save user message
      const userMsg: ChatMessage = {
        id: "msg-user-" + Date.now(),
        sender: "user",
        text: displayUserMessage || "Uploaded a questions file.",
        timestamp: new Date().toISOString(),
      };

      // Save AI response
      const aiMsg: ChatMessage = {
        id: "msg-ai-" + Date.now(),
        sender: "ai",
        text: aiResponseText,
        timestamp: new Date().toISOString(),
        sources: sources.length > 0 ? sources : undefined,
      };

      session.messages.push(userMsg, aiMsg);

      // Give Chat title a descriptive name if it was titled "New PDF Inquiry" and we have a message
      if (
        session.title === "New PDF Inquiry" &&
        session.messages.length === 2
      ) {
        const titleLabel = message ? message : `Q&A File: ${questionFileName}`;
        session.title =
          titleLabel.length > 40
            ? titleLabel.substring(0, 37) + "..."
            : titleLabel;
      }

      db.saveChatSession(session);

      // Save incremented prompt count
      const updatedUserObj = db.updateUser({
        id: req.user.id,
        promptCount: (user.promptCount || 0) + 1,
      });

      res.json({
        userMessage: userMsg,
        aiMessage: aiMsg,
        sessionTitle: session.title,
        promptCount: updatedUserObj
          ? updatedUserObj.promptCount
          : (user.promptCount || 0) + 1,
      });
    } catch (error: any) {
      console.error("Error managing chat message:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to analyze request" });
    }
  },
);

// Fetch Stats Analytics
app.get("/api/stats", authenticateToken, (req: any, res) => {
  try {
    const stats = db.getStats(req.user.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submits upgrade with TX reference
app.post("/api/billing/upgrade", authenticateToken, (req: any, res) => {
  try {
    const { plan, txId, paymentReceiptName, paymentReceiptData } = req.body;
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return res.status(400).json({
        error: "Invalid plan selected. Choose basic, pro, or premium.",
      });
    }

    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = db.updateUser({
      id: req.user.id,
      paymentPlanRequested: plan,
      paymentTxId: txId || `TX-${Date.now()}`,
      paymentReceiptName: paymentReceiptName || null,
      paymentReceiptData: paymentReceiptData || null,
      paymentStatus: "pending",
      paymentDate: new Date().toISOString(),
    });

    res.json({
      message:
        "Upgrade request submitted successfully! Pending admin approval.",
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Promoter endpoint to let developers/testers toggles/trigger Admin view easily in UI
app.post("/api/auth/make-admin", authenticateToken, (req: any, res) => {
  try {
    const updatedUser = db.updateUser({
      id: req.user.id,
      role: "admin",
    });
    res.json({
      message: "Successful switch: You are now an Admin!",
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin helper middleware
function requireAdmin(req: any, res: any, next: any) {
  const user = db.getUserById(req.user.id);
  // Authorize if user is explicitly admin or has designated emails
  if (
    user &&
    (user.role === "admin" ||
      user.email.toLowerCase() === "kassahunmulatu273@gmail.com" ||
      user.email.toLowerCase() === "admin@documind.ai")
  ) {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Admin access required" });
  }
}

// Admin get list of users with billing properties
app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  (req: any, res) => {
    try {
      const users = db.getUsers().map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        promptCount: u.promptCount || 0,
        tier: u.tier || "free",
        paymentStatus: u.paymentStatus || "none",
        paymentPlanRequested: u.paymentPlanRequested || null,
        paymentTxId: u.paymentTxId || null,
        paymentDate: u.paymentDate || null,
        paymentReceiptName: u.paymentReceiptName || null,
        paymentReceiptData: u.paymentReceiptData || null,
      }));
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Admin approves/declines a transaction request
app.post(
  "/api/admin/approve-payment",
  authenticateToken,
  requireAdmin,
  (req: any, res) => {
    try {
      const { userId, approved, tier, role, promptCount, paymentStatus } =
        req.body;
      const user = db.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedFields: any = {};
      if (approved !== undefined) {
        if (approved) {
          updatedFields.paymentStatus = "approved";
          updatedFields.tier = tier || user.paymentPlanRequested || "basic";
        } else {
          updatedFields.paymentStatus = "none";
          updatedFields.paymentPlanRequested = null;
          updatedFields.paymentTxId = null;
          updatedFields.paymentReceiptName = null;
          updatedFields.paymentReceiptData = null;
        }
      }

      if (tier !== undefined) {
        updatedFields.tier = tier;
      }

      if (role !== undefined) {
        updatedFields.role = role;
      }

      if (promptCount !== undefined) {
        updatedFields.promptCount = Number(promptCount);
      }

      if (paymentStatus !== undefined) {
        updatedFields.paymentStatus = paymentStatus;
      }

      const updatedUser = db.updateUser({
        id: userId,
        ...updatedFields,
      });

      res.json({
        message: "User status successfully updated!",
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Submit a contact message (Publicly available)
app.post("/api/contact", (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "All fields (name, email, subject, message) are required",
      });
    }

    const newMessage = {
      id: `msg-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    db.saveContactMessage(newMessage);

    res.json({
      message:
        "Your message has been received! Our administrator (kmulatu21@gmail.com) will review and reply soon.",
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// View all contact messages (Admin only)
app.get(
  "/api/admin/messages",
  authenticateToken,
  requireAdmin,
  (req: any, res) => {
    try {
      const messages = db.getContactMessages();
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Static website-only assistant endpoint
// This endpoint is intentionally strict: it only answers if a grounded match is found in the static corpus.
app.post("/api/assistant/static-qa", async (req: any, res: any) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question string is required" });
    }

    const { answer } = handleStaticQA(question);
    return res.json({ answer });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "static-qa failed" });
  }
});

// Fallback for unmatched API routes to prevent Vite SPA HTML responses
app.all("/api/*", (req, res) => {
  res
    .status(404)
    .json({ error: `API route ${req.method} ${req.path} not found` });
});

// Create global error-handling middleware to ensure all errors are returned as JSON, preventing Vite/HTML fallback issues
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Captured unhandled server error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error:
      err.message || "An unexpected error occurred during document processing",
  });
});

// Serve files physically inside uploads if authorized (optional, keep simple files private or accessible via proxy if required)
// Since we only query textual chunks, we don't need direct file serving routes unless they want to preview. Let's make it secure.

// --- BIND VITE DEV SERVER OR SERVE STATIC MAIN PAGE ---
async function startServer() {
  // Seed default admin user if not present
  try {
    const existingAdmin = db.getUserByEmail("kmulatu21@gmail.com");
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync("admin@docmind", 10);
      db.createUser({
        id: `usr-${Date.now()}`,
        name: "Kmulatu Admin",
        email: "kmulatu21@gmail.com",
        password: hashedPassword,
        role: "admin",
        createdAt: new Date().toISOString(),
        promptCount: 0,
        tier: "premium",
        paymentStatus: "approved",
      });
      console.log("Seeded default admin user: kmulatu21@gmail.com");
    } else {
      // Ensure the role is admin and tier is premium
      if (existingAdmin.role !== "admin" || existingAdmin.tier !== "premium") {
        db.updateUser({
          id: existingAdmin.id,
          role: "admin",
          tier: "premium",
          paymentStatus: "approved",
        });
        console.log(
          "Updated existing user kmulatu21@gmail.com to be Admin and Premium",
        );
      }
    }
  } catch (err) {
    console.error("Error seeding admin user:", err);
  }

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server launched on Port ${PORT}`);
    });
  }
}

startServer();

export default app;
