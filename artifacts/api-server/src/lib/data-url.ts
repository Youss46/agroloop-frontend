const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export function validateDataUrl(dataUrl: string, maxBytes = 5 * 1024 * 1024): { ok: true; mime: string; bytes: number } | { ok: false; error: string } {
  if (typeof dataUrl !== "string") return { ok: false, error: "Données invalides" };
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { ok: false, error: "Format data URL invalide" };
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) return { ok: false, error: `Type de fichier non autorisé: ${mime}` };
  const b64 = m[2];
  const padding = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  if (bytes > maxBytes) return { ok: false, error: `Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)}MB)` };
  return { ok: true, mime, bytes };
}
