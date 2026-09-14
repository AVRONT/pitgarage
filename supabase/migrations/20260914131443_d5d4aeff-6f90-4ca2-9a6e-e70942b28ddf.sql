UPDATE public.user_profiles
SET access_level = 'owner',
    operational_role = 'Proprietário',
    is_active = true,
    full_name = COALESCE(NULLIF(TRIM(full_name), ''), 'Proprietário'),
    updated_at = now()
WHERE user_id = '3eed06f8-4195-4538-aba1-fa0f15a9b3cf';