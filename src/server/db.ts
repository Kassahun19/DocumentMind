import fs from "fs";
import path from "path";
import {
  User,
  PDFDocument,
  PDFChunk,
  ChatSession,
  DashboardStats,
} from "../types";

let DB_FILE = path.join(process.cwd(), "data", "db.json");

// Memory cache of DB for serverless environment resilience & fast operations
let memoryDbCache: {
  users: any[];
  pdfs: PDFDocument[];
  chunks: PDFChunk[];
  chatSessions: ChatSession[];
  contactMessages?: any[];
} | null = null;

// Ensure database can be written in serverless functions (like Vercel) by leveraging the /tmp directory
if (process.env.VERCEL) {
  const tempDbPath = path.join("/tmp", "db.json");
  try {
    const dataDir = path.dirname(tempDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Always ensure a valid JSON schema exists for this invocation.
    // Serverless containers may start from a cold state without /tmp prewarming.
    if (!fs.existsSync(tempDbPath)) {
      if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, tempDbPath);
        console.log(
          "Vercel serverless prep: Cloned db.json template to writable /tmp/db.json",
        );
      } else {
        fs.writeFileSync(
          tempDbPath,
          JSON.stringify(
            {
              users: [],
              pdfs: [],
              chunks: [],
              chatSessions: [],
              contactMessages: [],
            },
            null,
            2,
          ),
          "utf-8",
        );
        console.log(
          "Vercel serverless prep: Created empty DB table in /tmp/db.json",
        );
      }
    }

    // If the file exists but is empty/corrupt, rewrite it with schema.
    if (fs.existsSync(tempDbPath)) {
      const stat = fs.statSync(tempDbPath);
      if (stat.size === 0) {
        fs.writeFileSync(
          tempDbPath,
          JSON.stringify(
            {
              users: [],
              pdfs: [],
              chunks: [],
              chatSessions: [],
              contactMessages: [],
            },
            null,
            2,
          ),
          "utf-8",
        );
        console.warn(
          "Vercel serverless prep: /tmp/db.json was empty; rewrote schema",
        );
      }
    }
  } catch (err) {
    console.error(
      "Vercel serverless prep failure: unable to create writable db in /tmp:",
      err,
    );
  }

  DB_FILE = tempDbPath;
}

// Ensure database directory and file exist
function initializeDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(
          {
            users: [],
            pdfs: [],
            chunks: [],
            chatSessions: [],
            contactMessages: [],
          },
          null,
          2,
        ),
        "utf-8",
      );
    }
  } catch (err) {
    console.error("Initialize DB error (ignored - using in-memory):", err);
  }
}

// Low-level read/write
function readData(): {
  users: any[];
  pdfs: PDFDocument[];
  chunks: PDFChunk[];
  chatSessions: ChatSession[];
  contactMessages: any[];
} {
  // If memory cache exists, return it directly
  if (memoryDbCache) {
    // Ensure array is initialized
    memoryDbCache.contactMessages = memoryDbCache.contactMessages || [];
    return memoryDbCache as any;
  }

  // Attempt to read from file
  try {
    initializeDb();
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      memoryDbCache = JSON.parse(content);
    }
  } catch (error) {
    console.error("Error reading database file, using empty schema:", error);
  }

  // Fallback if reading failed or produced empty cache
  if (!memoryDbCache) {
    memoryDbCache = {
      users: [],
      pdfs: [],
      chunks: [],
      chatSessions: [],
      contactMessages: [],
    };
  }

  // Ensure default structure
  memoryDbCache.users = memoryDbCache.users || [];
  memoryDbCache.pdfs = memoryDbCache.pdfs || [];
  memoryDbCache.chunks = memoryDbCache.chunks || [];
  memoryDbCache.chatSessions = memoryDbCache.chatSessions || [];
  memoryDbCache.contactMessages = memoryDbCache.contactMessages || [];

  return memoryDbCache as any;
}

function writeData(data: any): void {
  // Always update memory cache synchronously
  memoryDbCache = data;

  // Attempt to write to file safely in background/non-blocking path
  try {
    initializeDb();
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_FILE, content, "utf-8");
  } catch (error) {
    console.error(
      "Non-blocking writing failure (state retained in RAM):",
      error,
    );
  }
}

// User CRUD
export const db = {
  // Users
  getUserByEmail(email: string) {
    const data = readData();
    return data.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  },

  getUserById(id: string) {
    const data = readData();
    return data.users.find((u) => u.id === id);
  },

  createUser(user: any) {
    const data = readData();
    const newUser = {
      ...user,
      promptCount: user.promptCount ?? 0,
      tier: user.tier ?? "free",
      paymentStatus: user.paymentStatus ?? "none",
      paymentPlanRequested: user.paymentPlanRequested ?? null,
      paymentTxId: user.paymentTxId ?? null,
      paymentDate: user.paymentDate ?? null,
    };
    data.users.push(newUser);
    writeData(data);
    return newUser;
  },

  updateUser(user: any) {
    const data = readData();
    const idx = data.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      data.users[idx] = { ...data.users[idx], ...user };
      writeData(data);
      return data.users[idx];
    }
    return null;
  },

  getUsers() {
    const data = readData();
    return data.users;
  },

  // PDFs
  getPDFsByUser(userId: string): PDFDocument[] {
    const data = readData();
    return data.pdfs.filter((p) => p.userId === userId);
  },

  getPDF(pdfId: string): PDFDocument | undefined {
    const data = readData();
    return data.pdfs.find((p) => p.id === pdfId);
  },

  savePDF(pdf: PDFDocument): void {
    const data = readData();
    data.pdfs.push(pdf);
    writeData(data);
  },

  deletePDF(pdfId: string, userId: string): boolean {
    const data = readData();
    const pdfIndex = data.pdfs.findIndex(
      (p) => p.id === pdfId && p.userId === userId,
    );
    if (pdfIndex === -1) return false;

    // Remove file from disk
    const pdf = data.pdfs[pdfIndex];
    try {
      if (fs.existsSync(pdf.filePath)) {
        fs.unlinkSync(pdf.filePath);
      }
    } catch (e) {
      console.error("Error unlinking PDF file:", e);
    }

    data.pdfs.splice(pdfIndex, 1);

    // Cascading delete: chunks
    data.chunks = data.chunks.filter((c) => c.pdfId !== pdfId);

    // Cascading delete: clear any matching source references or leave as is.
    writeData(data);
    return true;
  },

  // Chunks & Embeddings
  saveChunks(chunks: PDFChunk[]): void {
    const data = readData();
    data.chunks.push(...chunks);
    writeData(data);
  },

  // Semantic retrieval using Cosine Similarity (Dot product on normalized vectors)
  searchSimilarChunks(
    userId: string,
    queryEmbedding: number[],
    topK: number = 4,
  ): { chunk: PDFChunk; similarity: number }[] {
    const data = readData();
    // Filter chunks by user
    const userChunks = data.chunks.filter((c) => c.userId === userId);
    if (userChunks.length === 0) return [];

    const scores = userChunks.map((chunk) => {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      const v1 = queryEmbedding;
      const v2 = chunk.embedding;

      const len = Math.min(v1.length, v2.length);
      for (let i = 0; i < len; i++) {
        dotProduct += v1[i] * v2[i];
        normA += v1[i] * v1[i];
        normB += v2[i] * v2[i];
      }

      const similarity =
        normA > 0 && normB > 0
          ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
          : 0;

      return { chunk, similarity };
    });

    // Sort by similarity descending
    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, topK);
  },

  // Chat sessions
  getChatSessions(userId: string): ChatSession[] {
    const data = readData();
    return data.chatSessions.filter((c) => c.userId === userId);
  },

  getChatSession(sessionId: string, userId: string): ChatSession | undefined {
    const data = readData();
    return data.chatSessions.find(
      (c) => c.id === sessionId && c.userId === userId,
    );
  },

  saveChatSession(session: ChatSession): void {
    const data = readData();
    const idx = data.chatSessions.findIndex((c) => c.id === session.id);
    if (idx !== -1) {
      data.chatSessions[idx] = session;
    } else {
      data.chatSessions.push(session);
    }
    writeData(data);
  },

  deleteChatSession(sessionId: string, userId: string): boolean {
    const data = readData();
    const idx = data.chatSessions.findIndex(
      (c) => c.id === sessionId && c.userId === userId,
    );
    if (idx === -1) return false;
    data.chatSessions.splice(idx, 1);
    writeData(data);
    return true;
  },

  // Statistics
  getStats(userId: string): DashboardStats {
    const data = readData();
    const userPdfs = data.pdfs.filter((p) => p.userId === userId);
    const userChunks = data.chunks.filter((c) => c.userId === userId);
    const userSessions = data.chatSessions.filter((s) => s.userId === userId);

    let totalChats = 0;
    userSessions.forEach((s) => {
      totalChats += s.messages.filter((m) => m.sender === "user").length;
    });

    let storageUsed = 0;
    userPdfs.forEach((p) => {
      storageUsed += p.fileSize;
    });

    return {
      totalDocs: userPdfs.length,
      totalChunks: userChunks.length,
      totalChats,
      storageUsed,
    };
  },

  getContactMessages() {
    const data = readData();
    return data.contactMessages || [];
  },

  saveContactMessage(msg: any) {
    const data = readData();
    data.contactMessages = data.contactMessages || [];
    data.contactMessages.push(msg);
    writeData(data);
    return msg;
  },
};
