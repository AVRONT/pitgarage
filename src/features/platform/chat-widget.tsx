import { AlertCircle, ArrowLeft, MessageCircle, Plus, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";

import { platformApi, type ChatContact, type ChatMessage, type Conversation } from "./platform-api";

type LocalMessage = ChatMessage & { delivery?: "sending" | "failed" };
type ChatView = "list" | "conversation" | "contacts";
const names = { team: "Equipe", direct: "Conversa direta", support: "Atendimento" } as const;
const types = { team: "Equipe da oficina", direct: "Conversa direta", support: "Cliente" } as const;
const conversationName = (item: Conversation) =>
  item.display_name ?? item.title ?? names[item.kind];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR"))
    .join("") || "?";
const time = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
        new Date(value),
      )
    : "";

export function ChatWidget() {
  const { accessLevel, identity, isLocalBypass } = useAuth();
  const currentUserId = identity?.userId ?? null;
  const currentName = identity?.profile.full_name ?? "Você";
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChatView>("list");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [body, setBody] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const activeIdRef = useRef(activeId);
  const openRef = useRef(open);

  useEffect(() => {
    activeIdRef.current = activeId;
    openRef.current = open;
  }, [activeId, open]);

  const loadConversations = useCallback(async () => {
    await platformApi.ensureChat();
    setConversations(await platformApi.conversations());
  }, []);

  useEffect(() => {
    if (isLocalBypass) return;
    void loadConversations().catch(() => setError("Não foi possível carregar as conversas."));
    if (accessLevel !== "customer") {
      void platformApi
        .chatContacts()
        .then(setContacts)
        .catch(() => setContacts([]));
    }
  }, [accessLevel, isLocalBypass, loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingMessages(true);
    setError("");
    void platformApi
      .messages(activeId)
      .then(setMessages)
      .catch(() => setError("Não foi possível carregar as mensagens."))
      .finally(() => setLoadingMessages(false));
  }, [activeId]);

  const markRead = useCallback(
    (conversationId: string) => {
      setConversations((current) =>
        current.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)),
      );
      void platformApi.markChatRead(conversationId).catch(() => void loadConversations());
    },
    [loadConversations],
  );

  useEffect(() => {
    if (!currentUserId || isLocalBypass) return;
    const channel = supabase
      .channel(`chat-messages:${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (event) => {
        const row = event.new as {
          id: string;
          conversation_id: string;
          sender_user_id: string | null;
          body: string;
          created_at: string;
        };
        const isActive = openRef.current && activeIdRef.current === row.conversation_id;
        if (activeIdRef.current === row.conversation_id) {
          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current;
            const pending = current.findIndex(
              (message) =>
                message.delivery === "sending" &&
                message.sender_user_id === row.sender_user_id &&
                message.body === row.body,
            );
            const incoming: LocalMessage = {
              id: row.id,
              sender_user_id: row.sender_user_id,
              sender_name:
                row.sender_user_id === currentUserId
                  ? currentName
                  : (current.find((message) => message.sender_user_id === row.sender_user_id)
                      ?.sender_name ?? "Usuário"),
              body: row.body,
              created_at: row.created_at,
            };
            return pending < 0
              ? [...current, incoming]
              : current.map((message, index) => (index === pending ? incoming : message));
          });
        }
        setConversations((current) => {
          if (!current.some((item) => item.id === row.conversation_id)) {
            void loadConversations();
            return current;
          }
          return current
            .map((item) =>
              item.id === row.conversation_id
                ? {
                    ...item,
                    last_message: row.body,
                    last_message_at: row.created_at,
                    updated_at: row.created_at,
                    unread_count:
                      isActive || row.sender_user_id === currentUserId
                        ? 0
                        : Number(item.unread_count) + 1,
                  }
                : item,
            )
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        });
        if (isActive && row.sender_user_id !== currentUserId) markRead(row.conversation_id);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentName, currentUserId, isLocalBypass, loadConversations, markRead]);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId),
    [activeId, conversations],
  );
  const openConversation = (item: Conversation) => {
    setActiveId(item.id);
    setView("conversation");
    markRead(item.id);
  };
  const startDirect = async (contact: ChatContact) => {
    setError("");
    try {
      const id = await platformApi.startDirect(contact.user_id);
      await loadConversations();
      setActiveId(id);
      setView("conversation");
      markRead(id);
    } catch {
      setError("Não foi possível iniciar a conversa.");
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || !activeId || !currentUserId) return;
    const temporaryId = `pending:${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    setBody("");
    setMessages((current) => [
      ...current,
      {
        id: temporaryId,
        sender_user_id: currentUserId,
        sender_name: currentName,
        body: text,
        created_at: createdAt,
        delivery: "sending",
      },
    ]);
    setConversations((current) =>
      current.map((item) =>
        item.id === activeId
          ? { ...item, last_message: text, last_message_at: createdAt, updated_at: createdAt }
          : item,
      ),
    );
    try {
      const id = await platformApi.sendMessage(activeId, text);
      setMessages((current) =>
        current.some((message) => message.id === id)
          ? current.filter((message) => message.id !== temporaryId)
          : current.map((message) => {
              if (message.id !== temporaryId) return message;
              return {
                id,
                sender_user_id: message.sender_user_id,
                sender_name: message.sender_name,
                body: message.body,
                created_at: message.created_at,
              };
            }),
      );
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === temporaryId ? { ...message, delivery: "failed" } : message,
        ),
      );
      setError("A mensagem não foi enviada.");
    }
  };

  const unread = conversations.reduce((sum, item) => sum + Number(item.unread_count), 0);
  if (isLocalBypass) return null;
  return (
    <>
      <Button
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg"
        size="icon"
        aria-label="Abrir chat"
        onClick={() => {
          setOpen(true);
          setView("list");
        }}
      >
        <MessageCircle />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <section className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[34rem] sm:w-96 sm:rounded-xl sm:border sm:shadow-2xl">
          <header className="flex min-h-16 items-center gap-2 border-b px-3 py-2">
            {view !== "list" && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Voltar"
                onClick={() => setView("list")}
              >
                <ArrowLeft />
              </Button>
            )}
            {view === "conversation" && active ? (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                  {initials(conversationName(active))}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{conversationName(active)}</strong>
                  <span className="block text-xs text-muted-foreground">{types[active.kind]}</span>
                </div>
              </>
            ) : (
              <strong className="flex-1">
                {view === "contacts" ? "Nova conversa" : "Conversas"}
              </strong>
            )}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Fechar chat"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </header>
          {view === "list" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {accessLevel !== "customer" && contacts.length > 0 && (
                <div className="border-b p-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setView("contacts")}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Nova conversa
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {conversations.map((item) => (
                  <button
                    key={item.id}
                    className="flex w-full gap-3 border-b p-3 text-left transition-colors hover:bg-slate-50"
                    onClick={() => openConversation(item)}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                      {initials(conversationName(item))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <b className="truncate text-sm">{conversationName(item)}</b>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {time(item.last_message_at ?? item.updated_at)}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {types[item.kind]}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          {item.last_message ?? "Nenhuma mensagem ainda"}
                        </span>
                        {Number(item.unread_count) > 0 && (
                          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                            {item.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
                {!conversations.length && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma conversa disponível.
                  </p>
                )}
              </div>
            </div>
          )}
          {view === "contacts" && (
            <div className="flex-1 overflow-auto">
              {contacts.map((contact) => (
                <button
                  key={contact.user_id}
                  className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-slate-50"
                  onClick={() => void startDirect(contact)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                    {initials(contact.full_name)}
                  </span>
                  <span>
                    <b className="block text-sm">{contact.full_name}</b>
                    <span className="text-xs text-muted-foreground">Equipe</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {view === "conversation" && (
            <>
              <div className="flex-1 space-y-1 overflow-auto bg-slate-50/60 p-3">
                {loadingMessages && (
                  <p className="text-center text-xs text-muted-foreground">Carregando…</p>
                )}
                {messages.map((message, index) => {
                  const own = message.sender_user_id === currentUserId;
                  const grouped = messages[index - 1]?.sender_user_id === message.sender_user_id;
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}
                    >
                      {!own && !grouped ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold shadow-sm">
                          {initials(message.sender_name)}
                        </span>
                      ) : !own ? (
                        <span className="w-7 shrink-0" />
                      ) : null}
                      <div
                        className={`max-w-[78%] rounded-xl px-3 py-2 text-sm shadow-sm ${own ? "bg-primary text-primary-foreground" : "bg-white"}`}
                      >
                        {!own && !grouped && active?.kind !== "direct" && (
                          <b className="mb-0.5 block text-[11px] text-primary">
                            {message.sender_name}
                          </b>
                        )}
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <span
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {time(message.created_at)}
                          {message.delivery === "sending" && " · Enviando"}
                          {message.delivery === "failed" && (
                            <>
                              <AlertCircle className="h-3 w-3" /> Falhou
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!loadingMessages && !messages.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Inicie a conversa.
                  </p>
                )}
              </div>
              {error && <p className="border-t px-3 py-1 text-xs text-red-700">{error}</p>}
              <form className="flex gap-2 border-t p-3" onSubmit={send}>
                <Input
                  value={body}
                  maxLength={4000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Mensagem"
                />
                <Button size="icon" disabled={!body.trim()} aria-label="Enviar mensagem">
                  <Send />
                </Button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
