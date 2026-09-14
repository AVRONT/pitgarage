CREATE UNIQUE INDEX IF NOT EXISTS vehicles_active_plate_unique
  ON public.vehicles (upper(replace(replace(plate, ' ', ''), '-', '')))
  WHERE deleted_at IS NULL;