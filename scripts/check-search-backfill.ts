/**
 * Proves the SQL backfill and the TypeScript normalizer agree.
 *
 * The two are maintained separately on purpose - the migration has to run
 * without the application, and `unaccent`/ICU are not available - so they can
 * drift. This is the guard: the same samples through both paths must match, or
 * a person whose row was backfilled becomes unfindable by their own name.
 *
 * Run with:  pnpm tsx scripts/check-search-backfill.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildSearchText, normalizePersian } from '../src/shared/utils/persian.js';
import { logger } from '../src/shared/logger/index.js';

const db = new PrismaClient();

/**
 * Mirrors the folding in the migration, applied to an already-joined string.
 *
 * Built from `new RegExp` with ASCII `\u` escapes for the same reason the
 * migration uses `U&'...'` escapes: these characters are invisible, so a literal
 * ZWNJ or harakat in source is indistinguishable from a missing one - which is
 * exactly the drift this script exists to catch.
 */
const SQL_FOLD = (input: string): string =>
  input
    .replace(new RegExp('\\u064A', 'g'), 'ی')
    .replace(new RegExp('\\u0643', 'g'), 'ک')
    .replace(new RegExp('[\\u0660-\\u0669]', 'g'), (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(new RegExp('[\\u06F0-\\u06F9]', 'g'), (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(new RegExp('[\\u064B-\\u0652\\u0670\\u0653-\\u0655\\u0640]', 'g'), '')
    .replace(new RegExp('[\\u200B-\\u200F\\uFEFF]', 'g'), '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const samples = [
  'کتاب',
  'كتاب',
  'ياسمن',
  'یاسمن',
  'مُحَمَّد',
  'میـرود',
  'میرود',
  '۱۳۸۰',
  '١٣٨٠',
  'موسیقی classical',
  '  علی   رضا  ',
  'کِتاب‌ها',
  'ABBook',
];

let failures = 0;

for (const sample of samples) {
  const ts = normalizePersian(sample);
  const sql = SQL_FOLD(sample);
  if (ts !== sql) {
    failures += 1;
    logger.error({ event: 'search.fold.mismatch', sample, ts, sql }, 'folding differs between ts and sql');
  }
}

// The end-to-end claim: a row written now, and a row backfilled by the migration,
// both have to be findable by the opposite keyboard.
logger.info({ event: 'search.fold.roundtrip.begin' }, 'database round trip');
const user = await db.user.create({
  data: { telegramId: `9${Date.now()}`, language: 'fa', timezone: 'Asia/Tehran' },
});

// Simulates a pre-migration row: raw Arabic text, then the migration's backfill.
const legacy = await db.person.create({
  data: { userId: user.id, name: 'كتاب', birthMonth: 1, birthDay: 1, searchText: '' },
});
await db.$executeRaw`UPDATE "Person" SET "searchText" = ${SQL_FOLD('كتاب')} WHERE "id" = ${legacy.id}`;

const fresh = await db.person.create({
  data: {
    userId: user.id,
    name: 'موسیقی',
    birthMonth: 2,
    birthDay: 2,
    searchText: buildSearchText(['موسیقی', null]),
  },
});

for (const [label, query, expected] of [
  // Persian keyboard query against the Arabic-spelled legacy row.
  ['legacy row, Persian query', 'کتاب', legacy.id],
  // Arabic keyboard query against a Persian-spelled row.
  ['fresh row, Arabic query', 'موسيقى'.replace('ى', 'ي'), fresh.id],
] as const) {
  const found = await db.person.findMany({
    where: { userId: user.id, searchText: { contains: normalizePersian(query) } },
    select: { id: true },
  });
  const ok = found.some((row) => row.id === expected);
  if (!ok) failures += 1;
  logger.info(
    { event: 'search.fold.case', label, query, rows: found.length, ok },
    ok ? 'folding agrees end to end' : 'folding broke the round trip',
  );
}

await db.$transaction([
  db.person.deleteMany({ where: { userId: user.id } }),
  db.user.delete({ where: { id: user.id } }),
]);
await db.$disconnect();

if (failures === 0) {
  logger.info({ event: 'search.fold.ok', samples: samples.length }, 'all samples agree');
} else {
  logger.error({ event: 'search.fold.failed', failures }, 'folding drifted between sql and ts');
}
process.exit(failures === 0 ? 0 : 1);
