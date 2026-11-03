-- Saturday Vibe Amerime format: 4 × 7-min shows + one 2-minute break (4 × 30-sec spots) per half hour
-- = 16 shows + 16 commercials in 2 hours. Only changes the block if it still has the previous default timing.
UPDATE "TvBlock" SET "breakEvery" = 4, "breakSeconds" = 120
WHERE "title" = 'Saturday Vibe Amerime' AND "breakEvery" = 1 AND "breakSeconds" = 60;
