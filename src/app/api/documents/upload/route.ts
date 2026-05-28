import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { detectFileSignature } from "@/lib/server/file-signatures";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/server/client-ip";
import { requireAuth } from "@/lib/server/auth";
import { getCanonicalUploadsRoot } from "@/lib/upload-security";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "png", "webp"]);

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// POST /api/documents/upload
// Accepts multipart form data: file, name, type, firearmId?, accessoryId?, notes?
// Saves to /storage/uploads/documents/{uuid}.{ext}
// Creates a Document record and returns it.
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth) return auth;

  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rate = await enforceRateLimit({ key: `upload:documents:${ip}`, windowMs: 60_000, maxAttempts: 20 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please wait a minute." },
        { status: 429 }
      );
    }

    const formData = await request.formData();

    const files = formData.getAll("files") as File[];
    const name = formData.get("name") as string | null;
    const type = (formData.get("type") as string | null) || "RECEIPT";
    const firearmId = formData.get("firearmId") as string | null;
    const accessoryId = formData.get("accessoryId") as string | null;
    const notes = formData.get("notes") as string | null;

    // --- FIX 1: Updated Validation ---
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    const uploadedDocuments = [];
    
    for (const file of files) {
      // Check the size for each individual file inside the loop
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `File ${file.name} is too large. Maximum size is 20MB.` }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const detected = detectFileSignature(buffer);
    
      if (!detected || !ALLOWED_EXTENSIONS.has(detected.extension)) {
        continue; 
      }
    
      const fileId = randomUUID().replace(/-/g, "");
      const fileName = `${fileId}.${detected.extension}`;
      const relativeUrl = `/api/files/documents/${fileName}`;
      const uploadDir = path.join(getCanonicalUploadsRoot(), "documents");
      const filePath = path.join(uploadDir, fileName);
    
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, buffer);
    
      const finalDocName = files.length > 1 ? `${name} - ${file.name}` : name;
    
      const doc = await prisma.document.create({
        data: {
          name: finalDocName,
          type,
          fileUrl: relativeUrl,
          fileSize: file.size,
          mimeType: detected.mimeType,
          notes: notes || null,
          firearmId: firearmId || null,
          accessoryId: accessoryId || null,
        },
        include: {
          firearm: { select: { id: true, name: true } },
          accessory: { select: { id: true, name: true } },
        },
      });
    
      uploadedDocuments.push(doc);
    }
    
    return NextResponse.json(uploadedDocuments, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents/upload error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
