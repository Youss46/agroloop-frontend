import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Camera, X, GripVertical, Loader2, Image as ImageIcon } from "lucide-react";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;
export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 6;

export interface UploadedPhoto {
  id: string;            // local uuid
  dataUrl: string;       // base64 data URL
  fileName: string;
  size: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface Props {
  photos: UploadedPhoto[];
  onChange: (next: UploadedPhoto[]) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Lecture du fichier échouée"));
    r.readAsDataURL(file);
  });
}

export function PhotoUploader({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) return;
    const slice = arr.slice(0, remainingSlots);

    const next: UploadedPhoto[] = [...photos];
    for (const file of slice) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // Validation client-side
      if (!ALLOWED.includes(file.type)) {
        next.push({ id, dataUrl: "", fileName: file.name, size: file.size, status: "error", error: "Format non supporté (JPG, PNG, WEBP uniquement)" });
        continue;
      }
      if (file.size > MAX_BYTES) {
        next.push({ id, dataUrl: "", fileName: file.name, size: file.size, status: "error", error: "Photo trop volumineuse (max 3MB)" });
        continue;
      }
      next.push({ id, dataUrl: "", fileName: file.name, size: file.size, status: "uploading" });
    }
    onChange(next);

    // Process readers in parallel
    await Promise.all(slice.map(async (file) => {
      const placeholder = next.find((p) => p.fileName === file.name && p.status === "uploading" && p.size === file.size);
      if (!placeholder) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        placeholder.dataUrl = dataUrl;
        placeholder.status = "done";
      } catch (e: any) {
        placeholder.status = "error";
        placeholder.error = e?.message ?? "Erreur";
      }
    }));
    onChange([...next]);
  }, [photos, onChange]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void addFiles(e.dataTransfer.files);
    }
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void addFiles(e.target.files);
    e.target.value = "";
  };

  const removeAt = (idx: number) => {
    const next = [...photos];
    next.splice(idx, 1);
    onChange(next);
  };

  // Native drag-to-reorder
  const onItemDragStart = (idx: number) => setDragIndex(idx);
  const onItemDragOver = (e: DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === idx) return;
    const next = [...photos];
    const [m] = next.splice(dragIndex, 1);
    next.splice(idx, 0, m);
    setDragIndex(idx);
    onChange(next);
  };
  const onItemDragEnd = () => setDragIndex(null);

  const validCount = photos.filter((p) => p.status === "done").length;
  const meetsMin = validCount >= MIN_PHOTOS;
  const ratio = Math.min(1, validCount / MIN_PHOTOS);

  return (
    <div className="space-y-4">
      {photos.length < MAX_PHOTOS && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors p-8 text-center ${
            dragOver ? "border-green-600 bg-green-50" : "border-green-600/60 bg-green-50/30 hover:bg-green-50"
          }`}
          data-testid="photo-uploader-zone"
        >
          <Camera className="mx-auto h-10 w-10 text-green-600 mb-2" />
          <p className="font-semibold text-green-800">Ajoutez des photos de vos résidus</p>
          <p className="text-xs text-muted-foreground mt-1">
            Minimum {MIN_PHOTOS} photos · Maximum {MAX_PHOTOS} · JPG, PNG, WEBP · 3MB max
          </p>
          <p className="text-[11px] text-orange-700 mt-2">
            Photos du produit uniquement. Toute image inappropriée entraînera la suppression de l'offre.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            capture="environment"
            className="hidden"
            onChange={onFileInput}
            data-testid="photo-uploader-input"
          />
        </div>
      )}

      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                draggable={p.status === "done"}
                onDragStart={() => onItemDragStart(idx)}
                onDragOver={(e) => onItemDragOver(e, idx)}
                onDragEnd={onItemDragEnd}
                className={`relative group aspect-square rounded-lg overflow-hidden border bg-muted ${dragIndex === idx ? "opacity-60" : ""}`}
                data-testid={`photo-tile-${idx}`}
              >
                {p.status === "done" ? (
                  <img src={p.dataUrl} alt={p.fileName} className="w-full h-full object-cover" />
                ) : p.status === "uploading" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs">Compression…</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-red-700 gap-1 px-2 text-center">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-[11px]">{p.error}</span>
                  </div>
                )}

                {idx === 0 && p.status === "done" && (
                  <span className="absolute top-1 left-1 bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Couverture
                  </span>
                )}

                <button
                  type="button"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full h-6 w-6 flex items-center justify-center hover:bg-red-600"
                  onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
                  aria-label="Supprimer"
                  data-testid={`button-remove-photo-${idx}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {p.status === "done" && (
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                )}

                {p.status === "done" && (
                  <span className="absolute bottom-1 right-1 bg-white/85 text-gray-700 rounded p-0.5 cursor-grab active:cursor-grabbing" title="Glisser pour réorganiser">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={meetsMin ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                {validCount} / {MIN_PHOTOS} photo(s) minimum requise(s)
              </span>
              {!meetsMin && (
                <span className="text-red-600">
                  Ajoutez encore {MIN_PHOTOS - validCount} photo(s)
                </span>
              )}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${meetsMin ? "bg-green-600" : "bg-red-500"}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Glisser pour réorganiser · La 1ère photo devient la couverture</p>
          </div>
        </>
      )}
    </div>
  );
}
