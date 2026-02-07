-- Migration 007: Add sort_order to landing_page_content

-- Add sort_order column
ALTER TABLE landing_page_content
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing rows with incremental sort_order based on current order
WITH ordered_content AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY section_key ASC) as rn
  FROM landing_page_content
)
UPDATE landing_page_content lpc
SET sort_order = oc.rn * 10
FROM ordered_content oc
WHERE lpc.id = oc.id;

-- Add index for better query performance
CREATE INDEX idx_landing_page_content_sort_order ON landing_page_content(sort_order);
