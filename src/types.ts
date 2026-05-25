export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  promptCount?: number;
  tier?: 'free' | 'basic' | 'pro' | 'premium';
  paymentStatus?: 'none' | 'pending' | 'approved';
  paymentPlanRequested?: 'basic' | 'pro' | 'premium' | null;
  paymentTxId?: string | null;
  paymentDate?: string | null;
  paymentReceiptName?: string | null;
  paymentReceiptData?: string | null;
}

export interface PDFDocument {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number; // in bytes
  pageCount: number;
  uploadDate: string;
}

export interface PDFChunk {
  id: string;
  pdfId: string;
  userId: string;
  text: string;
  embedding: number[];
  pageNum?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  sources?: {
    pdfId: string;
    fileName: string;
    text: string;
    pageNum?: number;
  }[];
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

// Auth API responses
export interface AuthResponse {
  user: User;
  token: string;
}

// Dashboard statistics
export interface DashboardStats {
  totalDocs: number;
  totalChunks: number;
  totalChats: number;
  storageUsed: number; // in bytes
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

