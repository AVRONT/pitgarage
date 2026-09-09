import { supabase } from "@/integrations/supabase/client";
import type { Evidence } from "./pilot-data";

export const evidenceBucket = "os-evidence";

export const photoMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const videoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
export const photoMaxBytes = 10 * 1024 * 1024;
export const videoMaxBytes = 50 * 1024 * 1024;

export const evidenceAccept = {
  Foto: photoMimeTypes.join(","),
  "Vídeo": videoMimeTypes.join(","),
} as const;

function extensionOf(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]{1,5}$/.test(fromName)) return fromName.toLowerCase();
  return file.type === "video/quicktime" ? "mov" : (file.type.split("/")[1] ?? "bin");
}

export function validateEvidenceFile(kind: Evidence["kind"], file: File) {
  const allowed = kind === "Foto" ? photoMimeTypes : videoMimeTypes;
  const maxBytes = kind === "Foto" ? photoMaxBytes : videoMaxBytes;
  if (!allowed.includes(file.type))
    return kind === "Foto"
      ? "Envie uma foto JPG, PNG ou WEBP."
      : "Envie um vídeo MP4, WEBM ou MOV.";
  if (file.size > maxBytes)
    return `Arquivo muito grande. Limite de ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  return null;
}

export async function uploadEvidenceFile(
  orderDatabaseId: string,
  kind: Evidence["kind"],
  file: File,
): Promise<Evidence> {
  const id = `e-${crypto.randomUUID()}`;
  const path = `${orderDatabaseId}/${id}.${extensionOf(file)}`;
  const { error } = await supabase.storage.from(evidenceBucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar o arquivo. Tente novamente.");
  return {
    id,
    kind,
    name: file.name,
    caption: kind === "Foto" ? "Foto do diagnóstico" : "Vídeo do diagnóstico",
    path,
    mimeType: file.type,
    size: file.size,
  };
}

export async function createEvidenceUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(evidenceBucket)
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeEvidenceFile(path: string) {
  const { error } = await supabase.storage.from(evidenceBucket).remove([path]);
  if (error) throw new Error("Não foi possível excluir o arquivo.");
}
