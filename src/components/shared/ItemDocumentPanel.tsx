"use client";

import { useState, useEffect } from "react";
import { Trash2, Upload, X } from "lucide-react";
import { DocumentUploader, type UploadedDocument } from "./DocumentUploader";

interface ItemPhotoGalleryProps {
  entityType: "firearm" | "accessory";
  entityId: string;
}

export default function ItemPhotoGallery({ entityType, entityId }: ItemPhotoGalleryProps) {
  const [photos, setPhotos] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const query = entityType === "firearm" ? `firearmId=${entityId}` : `accessoryId=${entityId}`;
        
        const res = await fetch(`/api/documents?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        
        setPhotos(data.filter((doc: UploadedDocument) => doc.type === "PHOTO"));
      } catch (error) {
        console.error("Failed to load photos", error);
      }
    };
    fetchPhotos();
  }, [entityType, entityId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      } else {
        console.error("Failed to delete the photo from the server");
      }
    } catch (error) {
      console.error("Failed to delete photo", error);
    }
  };

  return (
    <div className="rounded-xl border border-vault-border bg-vault-surface overflow-hidden">
      {/* Header aligned perfectly to match ItemDocumentPanel */}
      <div className="px-4 py-3 border-b border-vault-border flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-vault-text">Photo Gallery</h3>
          <p className="text-xs text-vault-text-faint">{photos.length} attached</p>
        </div>
        <button
          onClick={() => setIsUploading((v) => !v)}
          className="flex items-center gap-1.5 text-xs bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/20 px-2.5 py-1.5 rounded transition-colors"
        >
          {isUploading ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {isUploading ? "Close" : "Upload"}
        </button>
      </div>

      {isUploading && (
        <div className="p-4 border-b border-vault-border bg-vault-bg/50">
          <DocumentUploader
            entityType={entityType}
            entityId={entityId}
            defaultDocType="PHOTO"
            onUploadComplete={(doc) => {
              if (doc.type === "PHOTO") {
                setPhotos((prev) => [...prev, doc]);
                setIsUploading(false);
              }
            }}
            onCancel={() => setIsUploading(false)}
          />
        </div>
      )}

      <div className="p-4">
        {photos.length === 0 && !isUploading ? (
          <div className="p-6 text-center text-xs text-vault-text-faint bg-vault-bg rounded-lg border border-vault-border/50">
            No photos uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-vault-border bg-vault-bg aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.fileUrl}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-white truncate px-1">{photo.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
