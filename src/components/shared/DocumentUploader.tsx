"use client";

import { useState, useRef } from "react";
import { FileText, Upload, X, AlertCircle, FileIcon } from "lucide-react";

export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  firearmId: string | null;
  accessoryId: string | null;
  createdAt: string;
  firearm?: { id: string; name: string } | null;
  accessory?: { id: string; name: string } | null;
}

interface DocumentUploaderProps {
  entityType?: "firearm" | "accessory" | null;
  entityId?: string | null;
  defaultDocType?: "RECEIPT" | "PHOTO" | "NFA_TAX_STAMP" | "OTHER";
  onUploadComplete: (doc: UploadedDocument) => void;
  onCancel?: () => void;
}

const DOC_TYPES = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "PHOTO", label: "Photo" },
  { value: "NFA_TAX_STAMP", label: "NFA Tax Stamp" },
  { value: "OTHER", label: "Other" },
] as const;

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploader({
  entityType,
  entityId,
  defaultDocType = "RECEIPT",
  onUploadComplete,
  onCancel,
}: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<"RECEIPT" | "PHOTO" | "NFA_TAX_STAMP" | "OTHER">(defaultDocType);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Unified function to handle both drag-and-drop and click selections for arrays
  function handleFilesAdded(selectedFiles: File[]) {
    setError(null);
    
    // Filter out invalid files
    const validFiles = selectedFiles.filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) return false;
      if (f.size > MAX_SIZE) return false;
      return true;
    });

    if (validFiles.length < selectedFiles.length) {
      setError("Some files were skipped (invalid type or >20MB).");
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      if (!docName) {
        // Auto-fill name from the first valid filename (strip extension)
        const base = validFiles[0].name.replace(/\.[^.]+$/, "");
        setDocName(base);
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  }

  function removeFile(indexToRemove: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (files.length === 1) setError(null); // Clear errors if deleting the last file
  }

  async function handleUpload() {
    if (files.length === 0 || !docName.trim()) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((f) => {
        formData.append("files", f);
      });
      formData.append("name", docName.trim());
      formData.append("type", docType);
      if (entityType && entityId) {
        formData.append(entityType === "firearm" ? "firearmId" : "accessoryId", entityId);
      }
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(json.error ?? "Upload failed");
      }

      // 1. Parse the array of documents
      const uploadedDocs: UploadedDocument[] = await res.json();
      
      // 2. Loop through and trigger the complete callback for each
      uploadedDocs.forEach((doc) => {
        onUploadComplete(doc);
      });

      // 3. Reset the form
      setFiles([]);
      setDocName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {files.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[#00C2FF] bg-[#00C2FF]/5"
              : "border-vault-border hover:border-[#00C2FF]/40 hover:bg-vault-border/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(e) => { 
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(Array.from(e.target.files)); 
              }
            }}
          />
          <Upload className="w-8 h-8 text-vault-text-faint mx-auto mb-2" />
          <p className="text-sm text-vault-text-muted">Drop files here or click to browse</p>
          <p className="text-xs text-vault-text-faint mt-1">PDF, JPG, PNG, WebP — max 20MB</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* List all selected files */}
          {files.map((f, idx) => {
            const isPdf = f.type === "application/pdf";
            return (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-vault-border bg-vault-bg">
                {isPdf ? (
                  <FileText className="w-8 h-8 text-[#F5A623] shrink-0" />
                ) : (
                  <FileIcon className="w-8 h-8 text-[#00C2FF] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-vault-text truncate">{f.name}</p>
                  <p className="text-xs text-vault-text-faint">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-vault-text-faint hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          
          {/* Option to add more files to the queue */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#00C2FF] hover:underline"
            >
              + Add more files
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-widest text-vault-text-muted mb-1.5">
            Document Name <span className="text-[#E53935]">*</span>
          </label>
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="e.g. Glock 19 Purchase Receipt"
            className="w-full bg-vault-bg border border-vault-border text-vault-text rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00C2FF] placeholder-vault-text-faint transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-widest text-vault-text-muted mb-1.5">
            Document Type
          </label>
          <div className="flex gap-2">
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.value}
                type="button"
                onClick={() => setDocType(dt.value)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  docType === dt.value
                    ? "bg-[#00C2FF]/10 border-[#00C2FF]/30 text-[#00C2FF]"
                    : "border-vault-border text-vault-text-muted hover:bg-vault-border"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-widest text-vault-text-muted mb-1.5">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Original purchase from Cabela's, $549..."
            className="w-full bg-vault-bg border border-vault-border text-vault-text rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00C2FF] placeholder-vault-text-faint transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleUpload}
          disabled={files.length === 0 || !docName.trim() || uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[#00C2FF] text-sm hover:bg-[#00C2FF]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-[#00C2FF]/30 border-t-[#00C2FF] rounded-full animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "Uploading..." : "Upload Document"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-vault-border text-vault-text-muted text-sm hover:bg-vault-border transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
