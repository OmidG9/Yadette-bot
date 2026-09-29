-- §3.3 - make search work regardless of which keyboard the text was typed on.
--
-- Search previously normalized only the incoming query and compared it against
-- the raw `name`/`notes`/`title` columns. That silently fails for anyone who
-- types on an Arabic layout: searching "كتاب" would not find "کتاب", because
-- the two differ in code point. The fix is to store one canonical haystack per
-- person and match the folded query against it.
--
-- This migration adds the column and backfills existing rows, so a deployment
-- that already has data does not come up with everyone unfindable.

ALTER TABLE "Person" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

-- Character folding, mirroring `normalizePersian` in src/shared/utils/persian.ts.
-- Code points are written explicitly as U&'...' escapes so the mapping survives
-- any editor that might rewrite the file's encoding.
--
--   U+064A Arabic yeh      -> U+06CC Persian yeh
--   U+0643 Arabic kaf      -> U+06A9 Persian keheh
--   U+0660..U+0669 Arabic-Indic digits   -> ASCII
--   U+06F0..U+06F9 extended Arabic-Indic -> ASCII
--   U+064B..U+0652, U+0670, U+0653..U+0655, U+0640  (harakat, tatweel) -> removed
--   U+200B..U+200F, U+FEFF (ZWNJ, ZWJ, BOM)          -> removed
--
-- Deliberately absent: NFKC, which JavaScript applies but PostgreSQL cannot do
-- without the unaccent/ICU extensions. It only affects full-width and ligature
-- forms, which a name field does not normally contain; every folding that
-- actually matters for Persian text is above.
WITH folded AS (
  SELECT
    p."id",
    regexp_replace(
      regexp_replace(
        translate(
          translate(
            translate(
              concat_ws(' ', p."name", p."notes",
                (SELECT string_agg(i."title", ' ') FROM "Interest" AS i WHERE i."personId" = p."id")),
              U&'\064A\0643', U&'\06CC\06A9'),
            U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669', '0123456789'),
          U&'\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9', '0123456789'),
        U&'[\064B-\0652\0670\0653-\0655\0640]', '', 'g'),
      U&'[\200B-\200F\FEFF]', '', 'g'
    ) AS folded_text
  FROM "Person" AS p
)
UPDATE "Person" AS p
SET "searchText" = btrim(regexp_replace(lower(f.folded_text), '\s+', ' ', 'g'))
FROM folded AS f
WHERE f."id" = p."id";
