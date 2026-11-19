export const MAX_UPLOAD_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per photo
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB total per request

export type ValidatedImage = {
  file: File;
  safeName: string;
  detectedType: "image/png" | "image/jpeg";
};

export type ValidateUploadsResult =
  | { ok: true; images: ValidatedImage[] }
  | { ok: false; status: number; error: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function detectImageTypeFromMagicBytes(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | null {
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, idx) => bytes[idx] === b)) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  return null;
}

/**
 * Validates uploaded files on the server:
 * - Enforces file count (1..MAX_UPLOAD_FILES)
 * - Enforces per-file and total byte size caps
 * - Verifies actual PNG/JPEG magic bytes (prevents MIME/extension spoofing)
 * - Generates sanitized filenames for downstream Pl@ntNet requests
 */
export async function validateUploadedImages(
  entries: FormDataEntryValue[],
): Promise<ValidateUploadsResult> {
  const files = entries.filter(
    (item): item is File => item instanceof File && item.size > 0,
  );

  if (files.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Please upload at least one PNG or JPG photo.",
    };
  }

  if (files.length > MAX_UPLOAD_FILES) {
    return {
      ok: false,
      status: 400,
      error: `You can upload at most ${MAX_UPLOAD_FILES} photos at once.`,
    };
  }

  let totalBytes = 0;
  const validated: ValidatedImage[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Each photo must be under ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      };
    }

    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Total upload size must be under ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))} MB.`,
      };
    }

    const headerSlice = await file.slice(0, 12).arrayBuffer();
    const detectedType = detectImageTypeFromMagicBytes(
      new Uint8Array(headerSlice),
    );
    if (!detectedType) {
      return {
        ok: false,
        status: 415,
        error:
          "Unsupported image format. Please upload valid PNG or JPG/JPEG photos.",
      };
    }

    const ext = detectedType === "image/png" ? "png" : "jpg";
    validated.push({
      file,
      safeName: `plant-${i + 1}.${ext}`,
      detectedType,
    });
  }

  return { ok: true, images: validated };
}
