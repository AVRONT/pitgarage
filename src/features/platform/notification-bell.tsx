import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { platformApi, type Notification } from "./platform-api";

export function NotificationBell() {
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
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => void platformApi.readNotifications(null).then(load)}
            >
              Marcar todas
            </Button>
          </div>
          <div className="mt-2 max-h-80 space-y-2 overflow-auto">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  className="block w-full rounded-md border p-3 text-left text-sm"
                  onClick={() => void platformApi.readNotifications(item.id).then(load)}
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
