import { MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { platformApi, type ChatContact, type ChatMessage, type Conversation } from "./platform-api";

export function ChatWidget() {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [active, setActive] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [body, setBody] = useState("");
  const loadConversations = useCallback(async () => {
    const own = await platformApi.ensureChat();
    const list = await platformApi.conversations();
    setConversations(list);
    setActive((value) => value || own);
  }, []);
  const loadMessages = useCallback(() => {
    if (active) void platformApi.messages(active).then(setMessages);
  }, [active]);
  useEffect(() => {
    void loadConversations().catch(() => undefined);
    void platformApi
      .chatContacts()
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [loadConversations]);
  useEffect(() => {
    loadMessages();
    if (!active) return;
    const channel = supabase
      .channel(`chat:${active}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${active}`,
        },
        loadMessages,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, loadMessages]);
  useEffect(() => {
    if (open && active) void platformApi.markChatRead(active);
  }, [open, active, messages.length]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      await platformApi.sendMessage(active, body);
      setBody("");
      loadMessages();
    } finally {
      setLoading(false);
    }
  };
  const unread = conversations.reduce((sum, item) => sum + Number(item.unread_count), 0);
  return (
    <>
      <Button
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg"
        size="icon"
        aria-label="Abrir chat"
        onClick={() => setOpen(true)}
      >
        <MessageCircle />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px]">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <section className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[32rem] sm:w-96 sm:rounded-xl sm:border sm:shadow-2xl">
          <header className="flex items-center justify-between border-b p-4">
            <strong>Conversas</strong>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </header>
          {contacts.length > 0 && (
            <select
              className="mx-3 mt-3 rounded-md border p-2 text-sm"
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                void platformApi.startDirect(event.target.value).then((id) => {
                  setActive(id);
                  return loadConversations();
                });
                event.target.value = "";
              }}
            >
              <option value="">Nova conversa direta...</option>
              {contacts.map((contact) => (
                <option key={contact.user_id} value={contact.user_id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
          )}
          {conversations.length > 1 && (
            <select
              className="m-3 rounded-md border p-2"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title ?? c.kind}
                </option>
              ))}
            </select>
          )}
          <div className="flex-1 space-y-2 overflow-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className="rounded-md bg-slate-100 p-2 text-sm">
                <b>{m.sender_name}</b>
                <p>{m.body}</p>
              </div>
            ))}
            {!messages.length && (
              <p className="text-center text-sm text-muted-foreground">Inicie a conversa.</p>
            )}
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={send}>
            <Input
              value={body}
              maxLength={4000}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mensagem"
            />
            <Button size="icon" disabled={loading || !body.trim()}>
              <Send />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
