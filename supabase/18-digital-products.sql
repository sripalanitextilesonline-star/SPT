-- Digital (downloadable .zip) products and their order-line snapshots.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_file_key text,
  ADD COLUMN IF NOT EXISTS digital_file_name text,
  ADD COLUMN IF NOT EXISTS digital_file_size integer,
  ADD COLUMN IF NOT EXISTS digital_content_type text;

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS is_digital_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_file_key_snapshot text,
  ADD COLUMN IF NOT EXISTS digital_file_name_snapshot text;
