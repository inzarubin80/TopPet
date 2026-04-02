-- Удаляем подписи к краям шкалы (достаточно min/max/step).
ALTER TABLE contest_jury_criteria DROP COLUMN IF EXISTS label_low;
ALTER TABLE contest_jury_criteria DROP COLUMN IF EXISTS label_high;
