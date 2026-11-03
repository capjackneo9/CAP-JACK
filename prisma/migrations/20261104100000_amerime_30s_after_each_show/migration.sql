-- Saturday Vibe Amerime: one 30-second commercial after every 7-minute show
-- (16 × 7.5 min = 120 min). Only changes blocks still on the previous default timings.
UPDATE "TvBlock" SET "breakEvery" = 1, "breakSeconds" = 30
WHERE "title" = 'Saturday Vibe Amerime'
  AND (("breakEvery" = 4 AND "breakSeconds" = 120) OR ("breakEvery" = 1 AND "breakSeconds" = 60));
