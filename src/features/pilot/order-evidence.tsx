import { useEffect, useRef, useState } from "react";
import { ImagePlus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import type { Evidence, ServiceOrder } from "./pilot-data";
import {
  createEvidenceUrl,
  deleteEvidence,
  evidenceAccept,
  removeEvidenceFile,
  uploadEvidenceFile,
} from "./evidence-storage";

export type SaveEvidence = (
  change: (items: Evidence[]) => Evidence[],
  description: string,
) => Promise<void>;

export function EvidenceMedia({ evidence }: { evidence: Evidence }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(evidence.path));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    setLoading(Boolean(evidence.path));
    if (!evidence.path) return;
    void createEvidenceUrl(evidence.path)
      .then((signed) => {
        if (!active) return;
        setUrl(signed);
        if (!signed) {
          setFailed(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });
    // Renew before the one-hour URL expires; never persist the signed URL.
    const timer = window.setTimeout(() => setAttempt((value) => value + 1), 50 * 60 * 1000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [evidence.path, attempt]);
  if (!evidence.path)
    return <p className="py-3 text-sm text-slate-400">Registro antigo · sem arquivo anexado</p>;
  return (
    <div className="my-2 min-w-0">
      {loading && (
        <p role="status" className="py-2 text-sm">
          Carregando mídia…
        </p>
      )}
      {url &&
        !failed &&
        (evidence.kind === "Foto" ? (
          <img
            src={url}
            alt={evidence.caption}
            className="max-h-64 w-full rounded-md object-contain"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
        ) : (
          <video
            src={url}
            controls
            preload="metadata"
            className="max-h-64 w-full rounded-md"
            onLoadedMetadata={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          >
            Seu navegador não reproduz este vídeo.
          </video>
        ))}
      {failed && (
        <div role="alert" className="space-y-2 text-sm">
          <p>
            Não foi possível exibir o arquivo. O acesso pode ter expirado ou o formato não ser
            compatível com este navegador.
          </p>
          <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Tentar carregar novamente
          </Button>
        </div>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Abrir arquivo
        </a>
      )}
    </div>
  );
}

export function OrderEvidence({
  order,
  save,
  notify,
}: {
  order: ServiceOrder;
  save: SaveEvidence;
  notify: (message: string) => void;
}) {
  const { isLocalBypass, accessLevel, profile } = useAuth();
  const canEdit =
    !isLocalBypass &&
    profile?.is_active === true &&
    ["owner", "admin", "staff"].includes(accessLevel ?? "") &&
    Boolean(order.databaseId);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Evidence | null>(null);
  const [cleanup, setCleanup] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current || !canEdit) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const attach = async (evidence: Evidence) => {
    await save(
      (items) =>
        items.some((item) => item.id === evidence.id || (item.path && item.path === evidence.path))
          ? items
          : [...items, evidence],
      `${evidence.kind} adicionada ao diagnóstico`,
    );
    setPending(null);
    notify("Evidência enviada e salva na OS.");
  };
  const upload = (kind: Evidence["kind"], file?: File) => {
    if (!file || pending) return;
    void run(async () => {
      if (
        order.evidence.some(
          (item) =>
            item.path &&
            item.name === file.name &&
            item.size === file.size &&
            item.mimeType === file.type,
        )
      )
        throw new Error("Um arquivo com este nome, tipo e tamanho já está nesta OS.");
      const evidence = await uploadEvidenceFile(order.databaseId!, kind, file);
      setPending(evidence);
      await attach(evidence);
    });
  };
  return (
    <Card className="border-0 bg-slate-900 text-white">
      <CardContent className="p-6">
        <h2 className="font-bold">Fotos e vídeos</h2>
        <p className="mt-1 text-sm text-slate-400">
          JPG, PNG e WEBP até 10 MB. MP4, WEBM e MOV até 50 MB.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm">O envio requer uma OS salva e acesso ativo da equipe.</p>
        )}
        <input
          ref={photoInput}
          type="file"
          hidden
          accept={evidenceAccept.Foto}
          onChange={(event) => {
            upload("Foto", event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <input
          ref={videoInput}
          type="file"
          hidden
          accept={evidenceAccept["Vídeo"]}
          onChange={(event) => {
            upload("Vídeo", event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            disabled={!canEdit || busy || Boolean(pending)}
            onClick={() => photoInput.current?.click()}
            className="h-24 flex-col gap-2 bg-white/10 hover:bg-white/15"
          >
            <ImagePlus className="h-6 w-6" />
            Adicionar foto
          </Button>
          <Button
            disabled={!canEdit || busy || Boolean(pending)}
            onClick={() => videoInput.current?.click()}
            className="h-24 flex-col gap-2 bg-white/10 hover:bg-white/15"
          >
            <Video className="h-6 w-6" />
            Adicionar vídeo
          </Button>
        </div>
        {busy && (
          <p role="status" className="mt-3 text-sm">
            Processando arquivo e salvando a OS…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm">
            {error}
          </p>
        )}
        {pending && !busy && (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Arquivo enviado. A associação à OS ainda não foi confirmada. Não envie novamente;
              confira a versão salva se houver conflito.
            </p>
            <Button variant="outline" onClick={() => void run(() => attach(pending))}>
              Tentar salvar referência
            </Button>
          </div>
        )}
        {cleanup && (
          <div className="mt-3 space-y-2 text-sm">
            <p>A referência foi removida da OS, mas a exclusão do arquivo não foi confirmada.</p>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                void run(async () => {
                  await removeEvidenceFile(cleanup);
                  setCleanup(null);
                  notify("Arquivo excluído.");
                })
              }
            >
              Tentar excluir arquivo
            </Button>
          </div>
        )}
        <div className="mt-5 space-y-2">
          {order.evidence.map((evidence) => (
            <div key={evidence.id} className="min-w-0 rounded-xl bg-white/7 p-3">
              <strong className="block truncate text-sm">{evidence.caption}</strong>
              <span className="block truncate text-xs text-slate-400">{evidence.name}</span>
              <EvidenceMedia evidence={evidence} />
              {canEdit &&
                (confirmDelete === evidence.id ? (
                  <div className="flex flex-wrap gap-2">
                    <p className="w-full text-sm">Excluir esta evidência da OS e seu arquivo?</p>
                    <Button
                      disabled={busy || Boolean(cleanup) || Boolean(pending)}
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          const removed = await deleteEvidence(
                            evidence,
                            order.databaseId,
                            async () => {
                              let stillReferenced = false;
                              await save((items) => {
                                const remaining = items.filter((item) => item.id !== evidence.id);
                                stillReferenced = Boolean(
                                  evidence.path &&
                                  remaining.some((item) => item.path === evidence.path),
                                );
                                return remaining;
                              }, "Evidência removida do diagnóstico");
                              return !stillReferenced;
                            },
                          );
                          setConfirmDelete(null);
                          if (!removed) setCleanup(evidence.path!);
                          else notify("Evidência excluída.");
                        })
                      }
                    >
                      Confirmar exclusão
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={busy || Boolean(cleanup) || Boolean(pending)}
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(evidence.id)}
                  >
                    Excluir evidência
                  </Button>
                ))}
            </div>
          ))}
          {!order.evidence.length && (
            <p className="text-sm text-slate-400">Nenhuma foto ou vídeo anexado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
