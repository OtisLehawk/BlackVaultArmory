"use client";

import { useState, useEffect } from "react";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import DocumentUploader, { UploadedDocument } from "./DocumentUploader";

interface ItemPhotoGalleryProps {
  entityType: "firearm" | "accessory";
  entityId: string;
}

export default function ItemPhotoGallery({ entityType, entityId }: ItemPhotoGalleryProps) {
  const [photos, setPhotos] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch only the photos on load
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const res = await fetch(`/api/documents?entityType=${entityType}&entityId=${entityId}`);
        if (!res.ok) return;
        const data = await res.json();
        // Filter so we only keep photos
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
      }
    } catch (error) {
      console.error("Failed to delete photo", error);
    }
  };

  return (
    <div className="bg-vault-card border border-vault-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-vault-text flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[#00C2FF]" />
          Photo Gallery
        </h2>
        <button
          onClick={() => setIsUploading(!isUploading)}
          className="px-4 py-2 bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 rounded-md text-sm hover:bg-[#00C2FF]/20"
        >
          {isUploading ? "Cancel" : "Add Photos"}
        </button>
      </div>

      {isUploading && (
        <div className="mb-6 p-4 border border-dashed border-vault-border rounded-lg">
          <DocumentUploader
            entityType={entityType}
            entityId={entityId}
            defaultDocType="PHOTO" // Force it to be a photo
            onUploadComplete={(doc) => {
              if (doc.type === "PHOTO") setPhotos((prev) => [...prev, doc]);
            }}
            onCancel={() => setIsUploading(false)}
          />
        </div>
      )}

      {photos.length === 0 && !isUploading ? (
        <div className="text-center py-8 text-vault-text-faint bg-vault-bg rounded-lg border border-vault-border/50">
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
  );
}
