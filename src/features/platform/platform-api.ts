import { supabase } from "@/integrations/supabase/client";

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as <T>(
  name: string,
  args?: Record<string, unknown>,
) => RpcResult<T>;

export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  category: string;
  customer_id: string | null;
  vehicle_id: string | null;
  service_order_id: string | null;
};
export type Notification = {
  id: string;
  title: string;
  message: string;
  target: string | null;
  read_at: string | null;
  created_at: string;
};
export type Conversation = {
  id: string;
  kind: "team" | "direct" | "support";
  title: string | null;
  unread_count: number;
  updated_at: string;
};
export type ChatMessage = {
  id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};
export type ChatContact = { user_id: string; full_name: string };

async function required<T>(result: RpcResult<T>) {
  const response = await result;
  if (response.error) throw new Error(response.error.message);
  return response.data as T;
}
export const platformApi = {
  developerAccess: () => required(rpc<boolean>("has_developer_access")),
  developerDashboard: () => required(rpc<Record<string, unknown>>("get_developer_dashboard")),
  calendar: (start: string, end: string) =>
    required(rpc<CalendarEvent[]>("list_calendar_events", { range_start: start, range_end: end })),
  saveEvent: (
    event: Partial<CalendarEvent> & Pick<CalendarEvent, "title" | "starts_at" | "category">,
  ) =>
    required(
      rpc<string>("save_calendar_event", {
        event_id: event.id ?? null,
        event_title: event.title,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at ?? null,
        event_notes: event.notes ?? null,
        event_category: event.category,
        related_customer: event.customer_id ?? null,
        related_vehicle: event.vehicle_id ?? null,
        related_service_order: event.service_order_id ?? null,
      }),
    ),
  cancelEvent: (id: string) => required(rpc<void>("cancel_calendar_event", { event_id: id })),
  notifications: () => required(rpc<Notification[]>("list_my_notifications")),
  readNotifications: (id: string | null) =>
    required(rpc<void>("mark_my_notifications_read", { notification_id: id })),
  ensureChat: () => required(rpc<string>("ensure_my_chat")),
  conversations: () => required(rpc<Conversation[]>("list_my_conversations")),
  messages: (id: string) =>
    required(rpc<ChatMessage[]>("list_chat_messages", { target_conversation: id })),
  sendMessage: (id: string, body: string) =>
    required(rpc<string>("send_chat_message", { target_conversation: id, message_body: body })),
  markChatRead: (id: string) => required(rpc<void>("mark_chat_read", { target_conversation: id })),
  chatContacts: () => required(rpc<ChatContact[]>("list_chat_contacts")),
  startDirect: (userId: string) =>
    required(rpc<string>("start_direct_conversation", { target_user: userId })),
};

const deviceKey = "pitgarage_device_id_v1";
export function getDeviceId() {
  const existing = localStorage.getItem(deviceKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(deviceKey, created);
  return created;
}

export async function recordAccessEvent(
  eventType: "login_succeeded" | "session_restored" | "logout",
) {
  if (import.meta.env.DEV) return;
  await supabase.functions.invoke("access-event", { body: { eventType, deviceId: getDeviceId() } });
}
