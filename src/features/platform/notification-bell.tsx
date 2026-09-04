import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { platformApi, type Notification } from "./platform-api";

export function NotificationBell() {
  const { identity, isLocalBypass } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(
    () =>
      void platformApi
        .notifications()
        .then(setItems)
        .catch(() => setItems([])),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!identity?.userId || isLocalBypass) return;
    const channel = supabase
      .channel(`notifications:${identity.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${identity.userId}`,
        },
        (event) => {
          const item = event.new as Notification;
          if (!item?.id) return;
          setItems((current) => {
            const exists = current.some((currentItem) => currentItem.id === item.id);
            if (!exists) return [item, ...current];
            return current.map((currentItem) => (currentItem.id === item.id ? item : currentItem));
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.userId, isLocalBypass]);

  const markRead = async (id: string | null) => {
    const previous = items;
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        id === null || item.id === id ? { ...item, read_at: item.read_at ?? readAt } : item,
      ),
    );
    try {
      await platformApi.readNotifications(id);
    } catch {
      setItems(previous);
      load();
    }
  };
  const unread = items.filter((item) => !item.read_at).length;
  return (
    <div className="relative">
      <Button
        size="icon"
        variant="outline"
        aria-label="Notificações"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <section className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <strong>Notificações</strong>
            <Button variant="link" className="h-auto p-0" onClick={() => void markRead(null)}>
              Marcar todas
            </Button>
          </div>
          <div className="mt-2 max-h-80 space-y-2 overflow-auto">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  className="block w-full rounded-md border p-3 text-left text-sm"
                  onClick={() => void markRead(item.id)}
                >
                  <b>{item.title}</b>
                  <span className="mt-1 block text-muted-foreground">{item.message}</span>
                </button>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
