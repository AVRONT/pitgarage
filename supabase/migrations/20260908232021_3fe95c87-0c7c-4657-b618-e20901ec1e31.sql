GRANT EXECUTE ON FUNCTION pitgarage_private.can_access_conversation(uuid) TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;