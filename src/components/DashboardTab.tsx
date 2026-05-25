import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Upload, Trash2, Database, MessageSquare, 
  Layers, HardDrive, Info, AlertCircle, Sparkles, CheckCircle2 
} from 'lucide-react';
import { PDFDocument, DashboardStats, User } from '../types';

interface DashboardTabProps {
  stats: DashboardStats;
  pdfs: PDFDocument[];
  authToken: string;
  onRefresh: () => void;
  user: User;
}

export default function DashboardTab({ stats, pdfs, authToken, onRefresh, user }: DashboardTabProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper formatting size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Drag handles
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Upload controller with client-side chunking
  const uploadFiles = async (fileList: FileList) => {
    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setUploadError('Only PDF files are supported.');
      return;
    }

    // Client-side visual check on PDF plan constraints and limits
    const existingCount = pdfs.length;
    const tier = user?.tier || 'free';
    let maxAllowed = 1; // Free and Basic tiers allow 1 PDF
    if (tier === 'pro') {
      maxAllowed = 2; // Pro tier allows 2 PDFs
    } else if (tier === 'premium') {
      maxAllowed = 999; // Premium allows virtually unlimited PDFs
    }

    if (existingCount + validFiles.length > maxAllowed) {
      const upgradeMessage = tier === 'free' || tier === 'basic'
        ? 'Upgrade your tier to Pro (max 2) or Premium (unlimited) to upload more files.'
        : tier === 'pro'
          ? 'Upgrade your tier to Premium (unlimited) to upload more files.'
          : '';
      setUploadError(`PDF vault limit reached. Your active ${tier.toUpperCase()} Plan allows a maximum of ${maxAllowed} PDF upload(s). ${upgradeMessage}`);
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    setUploadProgress('Preparing documents...');

    try {
      const CHUNK_SIZE = 500 * 1024; // 500KB chunks are safely below any 1MB nginx reverse proxy limit

      for (const file of validFiles) {
        if (file.size <= CHUNK_SIZE) {
          // Fast path for small documents: standard single request
          setUploadProgress(`Uploading ${file.name}...`);
          const formData = new FormData();
          formData.append('files', file);

          const res = await fetch('/api/pdf/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: formData
          });

          const resText = await res.text();
          let data: any;
          try {
            data = JSON.parse(resText);
          } catch (parseErr) {
            throw new Error(res.ok ? 'Received invalid response format from server.' : `Server error (${res.status}): ${resText.substring(0, 150)}`);
          }

          if (!res.ok) {
            throw new Error(data.error || 'Uploading PDF files failed');
          }
        } else {
          // Robust client-side chunked upload for larger documents
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          const uploadId = Date.now() + '-' + Math.round(Math.random() * 100000);

          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            setUploadProgress(`Uploading "${file.name}": chunk ${chunkIndex + 1} of ${totalChunks}...`);

            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunkBlob = file.slice(start, end);

            const formData = new FormData();
            formData.append('uploadId', uploadId);
            formData.append('chunkIndex', chunkIndex.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('chunk', chunkBlob, file.name);

            const res = await fetch('/api/pdf/upload-chunk', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`
              },
              body: formData
            });

            if (!res.ok) {
              const resText = await res.text();
              let errData: any;
              try {
                errData = JSON.parse(resText);
              } catch (e) {}
              throw new Error(errData?.error || `Failed uploading fragment chunk idx ${chunkIndex + 1}. Error Code ${res.status}`);
            }
          }

          // Trigger server-side assembly, text parsing, and embedding indexation
          setUploadProgress('Analyzing, text parsing, and embedding indexing (please wait, it may take a few seconds)...');

          const assembleRes = await fetch('/api/pdf/assemble', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              uploadId,
              filename: file.name,
              totalChunks
            })
          });

          const assembleText = await assembleRes.text();
          let assembleData: any;
          try {
            assembleData = JSON.parse(assembleText);
          } catch (parseErr) {
            throw new Error(assembleRes.ok ? 'Invalid format from server.' : `Assembly error ${assembleRes.status}: ${assembleText.substring(0, 150)}`);
          }

          if (!assembleRes.ok) {
            throw new Error(assembleData.error || 'Failed assembling and mapping vector index');
          }
        }
      }

      setUploadSuccess(true);
      onRefresh();
      setTimeout(() => setUploadSuccess(false), 4500);
    } catch (err: any) {
      setUploadError(err.message || 'Connecting to PDF engine failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // Delete handler
  const handleDeletePdf = async (pdfId: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/pdf/${pdfId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete PDF');
      }
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Could not unlink paper');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto font-sans">
      
      {/* 1. Header Hero Panel */}
      <div className="p-6 md:p-8 rounded-3xl bg-radial from-indigo-505/10 to-transparent border border-slate-800/80 bg-slate-900/40 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs tracking-wider uppercase">
            <Sparkles className="h-4 w-4" /> AI Document Vector Engine
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Knowledge Dashboard
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Sift through your index vault. Upload academic literature, legal documents, reports, or research transcripts, and immediately chat with the model.
          </p>
        </div>
      </div>

      {/* 2. Top Stats Indicators Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md relative group hover:border-indigo-500/30 transition">
          <div className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <FileText className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p>
          <p className="text-2xl font-bold text-slate-100 mt-2">{stats.totalDocs}</p>
          <div className="mt-2 text-[11px] text-indigo-400 font-semibold uppercase tracking-wider text-[10px]">
            {user.tier === 'pro' ? 'Limit: 2 PDFs (Pro)' : user.tier === 'premium' ? 'Limit: 3+ PDFs (Premium)' : 'Limit: 1 PDF'}
          </div>
        </div>

        {/* Vector Chunks */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md relative group hover:border-cyan-500/30 transition">
          <div className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Layers className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vector Chunks</p>
          <p className="text-2xl font-bold text-slate-100 mt-2">{stats.totalChunks}</p>
          <div className="mt-2 text-[11px] text-slate-500">Similarity matrix nodes</div>
        </div>

        {/* Questions Asked */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md relative group hover:border-purple-500/30 transition">
          <div className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Inquiries</p>
          <p className="text-2xl font-bold text-slate-100 mt-2">{stats.totalChats}</p>
          <div className="mt-2 text-[11px] text-slate-500">Prompt requests logged</div>
        </div>

        {/* Storage Size */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md relative group hover:border-emerald-500/30 transition">
          <div className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <HardDrive className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vault Capacity</p>
          <p className="text-2xl font-bold text-slate-100 mt-2">{formatBytes(stats.storageUsed)}</p>
          <div className="mt-2 text-[11px] text-slate-500">Used sector footprint</div>
        </div>
      </div>

      {/* 3. Drag and Drop Uploader module */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`p-10 rounded-3xl border-2 border-dashed transition-all backdrop-blur-sm text-center flex flex-col items-center justify-center min-h-[220px] cursor-pointer ${
          dragActive 
            ? 'border-indigo-400 bg-indigo-500/5' 
            : 'border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/20'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden" 
        />

        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
          <Upload className="h-6 w-6 stroke-[2]" />
        </div>

        <h3 className="text-lg font-bold text-slate-100">Drag &amp; Drop PDF Files Here</h3>
        <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-normal">
          {user.tier === 'pro' && (
            <span className="text-cyan-400 block mb-1 font-semibold">Pro Level: Max 2 PDFs ({stats.totalDocs}/2 uploaded)</span>
          )}
          {user.tier === 'premium' && (
            <span className="text-purple-400 block mb-1 font-semibold">Premium Level: 3+ PDFs ({stats.totalDocs} uploaded)</span>
          )}
          {user.tier === 'basic' && (
            <span className="text-indigo-400 block mb-1 font-semibold">Basic Level: Max 1 PDF ({stats.totalDocs}/1 uploaded)</span>
          )}
          {(user.tier === 'free' || !user.tier) && (
            <span className="text-indigo-400 block mb-1 font-semibold">Free Level: Max 1 PDF ({stats.totalDocs}/1 uploaded)</span>
          )}
          Or <button onClick={(e) => { e.stopPropagation(); onButtonClick(); }} className="text-indigo-400 hover:underline cursor-pointer font-semibold inline">browse local storage</button> to index. Max 100MB.
        </p>

        {uploading && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wide animate-pulse">{uploadProgress || "Extracting textual documents & mapping vector nodes..."}</p>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-xs border border-red-500/20 bg-red-500/5 px-4 py-2 rounded-xl">
            <AlertCircle className="h-4 w-4" /> {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 rounded-xl">
            <CheckCircle2 className="h-4 w-4" /> Documents mapped and stored successfully!
          </div>
        )}
      </div>

      {/* 4. Document List Inventory Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 select-none">
          <Database className="h-5 w-5 text-indigo-400" /> Uploaded Document Manager
        </h3>

        {pdfs.length === 0 ? (
          <div className="p-8 border border-slate-900 bg-slate-900/10 rounded-2xl text-center">
            <FileText className="h-10 w-10 text-slate-700 mx-auto mb-3 stroke-[1.5]" />
            <h4 className="text-slate-400 font-semibold text-sm">No documents registered</h4>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">Upload a research, bank, academic, or corporate document above to activate semantic search operations.</p>
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-800 bg-slate-950/40 rounded-2xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs font-medium uppercase tracking-wider bg-slate-900/40">
                    <th className="py-4 px-6 text-left">Document Details</th>
                    <th className="py-4 px-6">Page Count</th>
                    <th className="py-4 px-6">Data Footprint</th>
                    <th className="py-4 px-6">Indexed Date</th>
                    <th className="py-4 px-6 text-right">Utility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pdfs.map((pdf) => (
                    <tr key={pdf.id} className="hover:bg-slate-900/20 transition group">
                      <td className="py-4 px-6 font-medium text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="truncate max-w-[200px] md:max-w-xs block font-semibold text-slate-300 group-hover:text-white transition">
                            {pdf.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-400">{pdf.pageCount} pages</td>
                      <td className="py-4 px-6 text-slate-400">{formatBytes(pdf.fileSize)}</td>
                      <td className="py-4 px-6 text-slate-500">
                        {new Date(pdf.uploadDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {deleteConfirmId === pdf.id ? (
                          <div className="flex justify-end gap-2 text-xs">
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            >
                              Cancel
                            </button>
                            <button 
                              disabled={deleteLoading}
                              onClick={() => handleDeletePdf(pdf.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition"
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(pdf.id)}
                            className="h-8 w-8 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                            title="Unlink and clear indices"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
