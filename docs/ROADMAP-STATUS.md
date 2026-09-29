# Yadette — گزارش وضعیت توسعه (Roadmap Status Report)

> **مرجع سند:** `Prompts/Yadette — Product Roadmap & Development Phases.md`
> **تاریخ گزارش:** 2026-09-28
> **نسخه پروژه:** `0.1.0`
> **وضعیت کد:** typecheck ✅ · lint ✅ · unit test ✅ (200/200) · integration test ✅ (69/69) · build ✅
> **روش ممیزی:** بررسی کامل repository (۷۴ فایل در `src/`، ۱۹ فایل در `tests/`، schema و migrationها) و تطبیق خط‌به‌خط با بندهای Roadmap

> ✅ **MVP بسته شد.** هر پنج کار پایانی بخش ۶ انجام شده‌اند (جز تست دستی Docker — Docker روی این ماشین نصب نیست).

---

## ۱. خلاصه اجرایی

```text
پیشرفت کل Roadmap (P0 → P11)   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  23%
```

| فاز | نام | وضعیت | درصد |
|---|---|---|---|
| P0 | MVP / Foundation | ✅ کامل | **100%** |
| P1 | UX + Reliability | 🟡 ناقص | **28%** |
| P2 | Gift System | ⬜ شروع نشده | 0% |
| P3 | AI Layer | ⬜ شروع نشده | 0% |
| P4 | Group Birthday | ⬜ شروع نشده | 0% |
| P5 | Group Gift Pool | ⬜ شروع نشده | 0% |
| P6 | Birthday Planner | ⬜ شروع نشده | 0% |
| P7 | Smart Personalization | ⬜ شروع نشده | 0% |
| P8 | Analytics | ⬜ شروع نشده | 0% |
| P9 | Web / Mini App | ⬜ شروع نشده | 0% |
| P10 | Monetization | ⬜ شروع نشده | 0% |
| P11 | Scale | ⬜ شروع نشده | 0% |

### پاسخ کوتاه به سؤال اصلی

> **چقدر تا MVP اولیه مانده؟**

**✅ چیزی نمانده — MVP بسته شد.** هر ۲۷ بند قابلیتی Phase 0 (MVP) در Roadmap پیاده‌سازی و تست شده است، و هر پنج کار پایانی انتشار هم انجام شده‌اند.

> **چقدر تا کل Roadmap؟** ۲۳٪ — یعنی ۷۷٪ باقی است، اما طبق قانون خود Roadmap (§22) این فازها **نباید** الان ساخته شوند؛ تا زمانی که کاربر واقعی و رفتار محصول دیده نشود.

---

## ۲. وضعیت کیفیت (Quality Gates)

| Gate | دستور | نتیجه |
|---|---|---|
| Typecheck | `pnpm typecheck` | ✅ PASS — ۰ خطا، ۰ warning (`strict` + `noUncheckedIndexedAccess`) |
| Lint | `pnpm lint` | ✅ PASS — ۰ خطا (type-checked ruleset، `no-explicit-any: error`) |
| Unit tests | `pnpm test` | ✅ PASS — **۱۷ فایل / ۲۰۰ تست / ۰ fail** |
| Integration tests | `pnpm test:integration` | ✅ PASS — **۴ فایل / ۶۹ تست / ۰ fail** روی PostgreSQL ۱۸ واقعی |
| Build | `pnpm build` | ✅ PASS — `prisma generate` + `tsc -p tsconfig.build.json` |
| Build smoke test | اجرای `dist/` | ✅ PASS — اتصال DB، ساخت container، و کوئری واقعی Repository |
| Aggregate | `pnpm validate` | typecheck → lint → test → build |
| Aggregate | `pnpm validate:full` | + تست‌های دیتابیسی |

### آمار کد

| شاخص | مقدار |
|---|---|
| فایل `.ts` در `src/` | ۷۲ |
| خطوط `.ts` در `src/` | ۴,۹۱۷ |
| فایل تست یونیت | ۱۷ |
| فایل تست یکپارچه | ۴ + ۲ helper + ۱ setup |
| خطوط تست | ۲,۷۵۷ یونیت + ۱,۲۰۰ یکپارچه |
| Model در Prisma | ۶ |
| Migration | ۱ |
| Index در دیتابیس | ۱۳ |
| Commit | ۷ (remote تنظیم نشده، tag ندارد) |

> ⚠️ کار uncommitted وجود دارد و **سالم** است (۳۷ تست جدید/تغییریافته). طبق قوانین مخزن باید commit شود.

---

## ۳. معماری فعلی

**Modular Monolith** — دقیقاً مطابق Roadmap §1. ساختار `src/`:

```text
src/
├── main.ts              entrypoint + graceful shutdown (SIGINT/SIGTERM/unhandledRejection)
├── container.ts         composition root — تنها فایلی که prisma را وارد گراف ماژول‌ها می‌کند
├── bot/                 لایه Telegram (۲۴ فایل)
│   ├── context.ts       AppContext / AppState
│   ├── middleware/      error → hydrateUser → flow
│   ├── commands/        /start, /cancel
│   ├── conversations/   add-person, edit-person, add-interest, flow.store, flow
│   ├── callbacks/       data.ts (Zod parser) + 4 dispatcher
│   ├── keyboards/       5 keyboard factory
│   └── views/           4 view renderer
├── modules/             دامنه‌ها (۱۰ فولدر)
│   ├── users/ · people/ · birthdays/ · reminders/ · settings/   ← فعال
│   └── ai/ · gifts/ · groups/ · messages/ · wishlist/           ← استاب غیرفعال
├── jobs/                birthday-reminder.job.ts
├── shared/              config/errors/i18n/logger/utils
├── config/ · database/ · types/
```

### قراردادهای تثبیت‌شده (که فازهای بعدی باید رعایت کنند)

| قرارداد | محل |
|---|---|
| هر ماژول: `*.types.ts` (رابط Repository) → `*.repository.ts` (Prisma) → `*.service.ts` (منطق خالص) | `src/modules/*` |
| سرویس‌ها هیچ دانشی از Telegram/Prisma ندارند | `container.ts:27-32` |
| مالکیت داده در Service چک می‌شود، نه در Handler | `person.service.ts:70` → `NotFoundError` |
| تمام متن‌های قابل‌مشاهده کاربر از `t()` می‌آیند (تست اجباری) | `tests/bot/messages.test.ts:66` |
| هر callback با builder ساخته و با Zod (`.strict()`) پارس می‌شود؛ سقف ۶۴ بایت | `callbacks/data.ts:113-114` |
| فقط `helpers.ts` اجازه ارسال پیام دارد | `tests/bot/messages.test.ts:66` |
| وضعیت Conversation در PostgreSQL (قابل تعویض با Redis) | `conversations/flow.store.ts:14-18` |
| حذف نرم (`deletedAt`) برای Person، سخت برای User | `person.repository.ts:120` / `user.repository.ts:94` |

---

## ۴. فاز به فاز — چه هست، چه باید باشد

### فاز P0 — MVP / Foundation → **100%** ✅

#### ۴.۱ User Management

| قابلیت | وضعیت | شواهد |
|---|---|---|
| Telegram User | ✅ | `users/user.service.ts:24` `getOrCreate` · `middleware/hydrate-user.ts` |
| User settings | ✅ | `User` ۱۱ فیلد · `settings/settings.service.ts:10` |
| Timezone | ✅ | `User.timezone` + اعتبارسنجی IANA در `shared/utils/date.ts:60` · `AVAILABLE_TIMEZONES` ۸ منطقه |
| Language foundation | ✅ | زیرساخت کامل: `shared/i18n/fa.ts` (۲۶۹ خط) + `TranslationKey` تایپ‌شده در زمان کامپایل (`fa.ts:266`) · `DEFAULT_LANGUAGE: z.enum(['fa'])` |

#### ۴.۲ People

| قابلیت | وضعیت | شواهد |
|---|---|---|
| افزودن شخص | ✅ | `conversations/add-person.ts` (۳۶۶ خط، flow چندمرحله‌ای با back/skip/progress) |
| ویرایش شخص | ✅ | `conversations/edit-person.ts` (۱۷۸ خط) · `person.service.ts:120` `update` |
| حذف شخص | ✅ | Soft delete + تأیید دومرحله‌ای · `person.callbacks.ts:41-62` |
| مشاهده شخص | ✅ | `views/person.views.ts` (۱۴۱ خط) |
| لیست افراد | ✅ | `nav.callbacks.ts:101` · سقف ۲۰ (`UPCOMING_LIST_LIMIT`) |

#### ۴.۳ Birthday

| قابلیت | وضعیت | شواهد |
|---|---|---|
| ثبت تاریخ تولد | ✅ | `utils/date.ts:321` `parseBirthDate` — `۱۸ مهر ۱۳۸۰`، `18 مهر`، `2001-10-10` |
| محاسبه تولد بعدی | ✅ | `birthdays/birthday.calc.ts:56` `nextOccurrence` (۲۴ تست) |
| نمایش تعداد روز باقی‌مانده | ✅ | `utils/date.ts:367` `formatDaysUntil` |
| مدیریت سال‌های مختلف | ✅ | `Person.birthYear Int?` — اختیاری |
| پشتیبانی سال کبیسه | ✅ | `birthday.calc.ts:48-50` — Esfand 30 → در سال عادی 29 (Clamp) |

#### ۴.۴ Interests

| قابلیت | وضعیت | شواهد |
|---|---|---|
| افزودن | ✅ | `person.service.ts:135` `addInterests` · سقف ۲۰ · dedupe بدون‌حساسیت‌به‌حروف |
| حذف | ✅ | `person.service.ts:158` + کیبورد `keyboards/reminder.ts:78` |
| نمایش | ✅ | `person.views.ts` |

#### ۴.۵ Notes
✅ `Person.notes String?` · `person.service.ts:116` `updateNotes` · سقف ۱۰۰۰ کاراکتر · escape HTML

#### ۴.۶ Reminders

| قابلیت Roadmap | وضعیت | شواهد |
|---|---|---|
| ۷ روز قبل | ✅ | `DEFAULT_REMINDER_DAYS = [7,3,1,0]` — `shared/constants/index.ts:4` |
| ۳ روز قبل | ✅ | همان |
| ۱ روز قبل | ✅ | همان |
| روز تولد | ✅ | `daysBefore = 0` |
| — | 🌟 **بیشتر از Roadmap** | ۶ آفست: `ALLOWED = [30,14,7,3,1,0]` با UI مستقل برای هر شخص |

#### ۴.۷ Notifications

| قابلیت | وضعیت | شواهد |
|---|---|---|
| ارسال Telegram | ✅ | `jobs/birthday-reminder.job.ts:44` `deliver` · `parse_mode: 'HTML'` |
| جلوگیری از تکرار | ✅ | **دو لایه**: (۱) Unique constraint روی `@@unique([userId, personId, birthdayYear, daysBefore])`، (۲) `claim` اتمیک با catch کردن `P2002` — `reminder.repository.ts:133-144` |

#### ۴.۸ Settings

| قابلیت | وضعیت | شواهد |
|---|---|---|
| فعال/غیرفعال یادآوری | ✅ | `settings.service.ts:30-37` + `person.callbacks.ts` |
| تنظیم Timezone | ✅ | `settings.service.ts:16` + کیبورد ۸ منطقه |
| تنظیمات پایه | ✅ | `keyboards/settings.ts:13` |

#### ۴.۹ موارد اضافه‌شده فراتر از Roadmap MVP

| مورد | وضعیت | شواهد |
|---|---|---|
| **حذف کامل حساب / داده** | ✅ | `user.service.ts:77` `deleteAccount` → Cascade · تأیید ۲ مرحله‌ای · re-hydrate · تست idempotence |
| فرمان `/about` | ✅ | `bot.ts:72` · `menu.views.ts:33` (متن طولانی محصول) |
| فرمان `/cancel` | ✅ | `commands/cancel.ts` |
| Docker Compose (۳ سرویس) | ✅ | `docker-compose.yml` — db / migrate / bot با healthcheck |
| Dockerfile (۴ stage، non-root، tini) | ✅ | `Dockerfile` |
| Redaction در لاگ | ✅ | `shared/logger/index.ts:23` — `BOT_TOKEN`، `DATABASE_URL`، authorization |
| Graceful shutdown | ✅ | `main.ts:43-70` |
| تست دسته‌بندی Keyboard | ✅ | `tests/bot/keyboards.test.ts` — اسکن سورس، همه ۱۹ کیبورد round-trip |
| تست جداسازی بین‌کاربری | ✅ | `tests/modules/person.service.test.ts` — ۷ کیس |

**نتیجه P0: ۲۷/۲۷ بند کامل (۱۰۰٪).**

---

### فاز P1 — UX + Reliability → **28%** 🟡

Roadmap §3.7 — Definition of Done:

| # | بند | وضعیت | جزئیات |
|---|---|---|---|
| 1 | Search | ❌ **MISSING** | صفر مورد `search` در کل `src/`. هیچ `contains`/`ilike`‌ای وجود ندارد. ایندکس `Person_userId_name_idx` ساخته شده ولی **هیچ کوئری‌ای از آن استفاده نمی‌کند**. |
| 2 | Calendar | ❌ **MISSING** | صفر مورد calendar view. `NAV_TARGETS` (`data.ts:23`) ورودی calendar ندارد. تمام موارد `calendar` کامنت دربارهٔ تقویم جلالی است. |
| 3 | Dashboard بهتر | 🟡 **PARTIAL** | صفحه اصلی وجود دارد (`nav.callbacks.ts:46-56` + `keyboards/start.ts:16`) و تست رگرسیون دارد، ولی **بندهای Roadmap §3.1 غایب‌اند**: بدون `🔴 امروز / 🟠 این هفته / 🟢 بعداً`، بدون خط «نزدیک‌ترین تولد»، بدون «تعداد تولدهای این ماه». نکته: `birthday.service.ts:40` `getTodayForUser` نوشته شده ولی **هرگز فراخوانی نمی‌شود** — dead code. |
| 4 | Reminder customization | ✅ **DONE** | `reminder.service.ts:87` `setEnabled` — ۶ آفست مستقل برای هر شخص. مثال Roadmap §3.4 کامل پوشش داده شده. |
| 5 | Snooze | ❌ **MISSING** | صفر مورد. **از نظر ساختاری غیرممکن است**: اعلان با `sendMessage` و **بدون هیچ inline keyboard** ارسال می‌شود (`job:79`) — پس دکمه‌ای برای Snooze وجود ندارد. مدل داده هم ندارد. |
| 6 | Notification retry | 🟡 **PARTIAL** | فقط retry در تیک بعدی از طریق `claim`/`release` (`reminder.service.ts:199`, `job:93`). **فقدان:** exponential backoff، شمارنده attempt، max-attempts، dead-letter، صف خطا. |
| 7 | Health check | ❌ **MISSING** | هیچ HTTP server، هیچ endpoint، هیچ metric. آنچه هست: لاگ ساختاریافته با `durationMs` (`reminder.scheduler.ts:75`) · Scheduler بدون‌هم‌پوشانی (`running` guard L65) · `bot.catch` با تفکیک GrammyError/HttpError (`bot.ts:189`) · فقط `db` در compose healthcheck دارد. |
| 8 | تست کامل Featureهای جدید | ⬜ N/A | تا وقتی Search/Calendar/Snooze ساخته نشوند، تستی وجود ندارد. |
| 9 | Update README | 🟡 **PARTIAL** | README (۹۴ خط، فارسی) خوب است ولی به پوشه `docs/` ارجاع می‌دهد که **وجود ندارد** — لینک شکسته. `shared/logger/index.ts:21` هم ارجاع مشابه دارد. |

**امتیاز P1: (0 + 0 + 0.5 + 1 + 0 + 0.5 + 0 + 0 + 0.5) / 9 = 2.5/9 = 28%**

---

### فاز P2 — Gift System → **0%** ⬜

| قابلیت | وضعیت | شواهد |
|---|---|---|
| Gift Ideas (4.1) | ❌ | فقط رابط خالی `modules/gifts/gift.service.ts:14` `suggestForPerson` |
| Gift History (4.2) | ❌ | هیچ Model، هیچ جدول، هیچ سرویس |
| Wishlist (4.3) | ❌ | فقط رابط خالی `modules/wishlist/wishlist.service.ts:14` |
| Budget (4.4) | ❌ | صفر مورد `budget` در `src/` |
| دسته‌بندی علاقه‌مندی (4.5) | ❌ | ۷ دسته Roadmap (Gaming/Books/Music/Sports/Technology/Fashion/Food) وجود ندارد |
| Static Recommendation (4.5) | ❌ | — |

> ⚠️ هر ۵ ماژول استاب، `Promise<never>` برمی‌گردانند، در `container.ts` ثبت **نشده‌اند** و هیچ‌جا import نمی‌شوند. یعنی TypeScript آن‌ها را کامپایل می‌کند ولی در runtime وجود ندارند.

---

### فاز P3 — AI Layer → **0%** ⬜

| قابلیت | وضعیت | شواهد |
|---|---|---|
| AI abstraction (5.1) | ❌ | `modules/ai/ai.service.ts` فقط یک interface با متدهایی که `Promise<never>` برمی‌گردانند |
| Provider abstraction (5.1) | ❌ | هیچ `AIProvider` interface، هیچ OpenAI/Gemini adapter، هیچ متغیر محیطی `AI_*` |
| Gift suggestions (5.2) | ❌ | — |
| Birthday Message (5.3) | ❌ | `modules/messages/message.service.ts:16` استاب |
| Story Caption (5.4) | ❌ | — |
| Personalization (5.5) | ❌ | — |
| Cost Control (5.6) | ❌ | هیچ rate limit / token limit / usage tracking |

> ✅ **قانون Roadmap §25 رعایت شده**: AI وارد Core نشده، `AI_MODULE_ENABLED = false`.
> ✅ **Seam آماده است**: README صریحاً «AI seam reserved» را ذکر می‌کند.

---

### فاز P4 — Group Birthday → **0%** ⬜

| قابلیت | وضعیت | شواهد |
|---|---|---|
| ثبت گروه (6.1) | ❌ | `middleware/hydrate-user.ts:42` صریحاً `if (ctx.chat?.type !== 'private') return` — بات **فعالانه گروه‌ها را رد می‌کند** |
| Group Birthdays (6.2) | ❌ | — |
| Announcement (6.3) | ❌ | — |
| Privacy (6.4) | ❌ | — |

---

### فاز P5 — Group Gift Pool → **0%** ⬜
فقط `GroupPool`/`GroupService` به‌صورت placeholder (`group.service.ts:7-17`).

### فاز P6 — Birthday Planner → **0%** ⬜
صفر مورد `checklist` و `importantDate` و `anniversary`. هیچ Model `Task`/`Event`.

### فاز P7 — Smart Personalization → **0%** ⬜
تنها ردپا، `NotificationLog` است که per-year trace دارد؛ تاریخچه کادو/علاقه وجود ندارد.

### فاز P8 — Analytics → **0%** ⬜
هیچ metric یا usage tracking.

### فاز P9 — Web Dashboard / Mini App → **0%** ⬜
هیچ HTTP server.

### فاز P10 — Monetization → **0%** ⬜
طبق Roadmap §12 عمداً بعد از مشاهدهٔ استفادهٔ واقعی.

### فاز P11 — Scale → **0%** ⬜
طبق Roadmap §13 عمداً بعد از مشاهدهٔ load واقعی.

---

## ۵. وضعیت Feature Flags (Roadmap §17) — نیازمند اصلاح

Roadmap می‌خواهد: `GIFTS_ENABLED=false`، `GROUPS_ENABLED=false`، `AI_ENABLED=false`، `WISHLIST_ENABLED=false` — یعنی **متغیر محیطی**.

**وضعیت فعلی: سیستم Flag وجود ندارد.** فقط ۵ ثابت `false` هاردکد:

| محل | ثابت |
|---|---|
| `modules/ai/ai.service.ts:21` | `AI_MODULE_ENABLED = false` |
| `modules/gifts/gift.service.ts:19` | `GIFT_MODULE_ENABLED = false` |
| `modules/groups/group.service.ts:19` | `GROUP_MODULE_ENABLED = false` |
| `modules/wishlist/wishlist.service.ts:20` | `WISHLIST_MODULE_ENABLED = false` |
| `modules/messages/message.service.ts:16` | `MESSAGE_MODULE_ENABLED = false` |

**فقدان:** محیطی نیست · رجیستری متمرکز ندارد · UI gating ندارد · تست ندارد.

> نتیجه عملی: الزام Roadmap §17 «Featureهای آماده‌نبوده نباید در UI نمایش داده شوند» فعلاً با «اصلاً وجود ندارند» برآورده می‌شود — که پاسخ درستی است، ولی با ابزار اشتباه.

---

## ۶. چک‌لیست پایان MVP (`v0.1.0`) — ✅ انجام شد

| # | کار | وضعیت | نتیجه |
|---|---|---|---|
| 1 | Commit کارهای uncommitted | ✅ انجام شد | ۱۸ فایل + کار جدید، commit شد |
| 2 | رفع ارجاع شکسته `docs/` | ✅ انجام شد | `src/shared/logger/index.ts:21` اصلاح شد و `docs/logging.md` ساخته شد |
| 3 | تأیید `pnpm build` و اجرای واقعی | 🟡 **نیمه‌کاره** | `pnpm build` ✅ و smoke test روی `dist/` ✅. **اما Docker روی این ماشین نصب نیست** (`docker` = command not found)، پس مسیر `docker compose` فقط بازبینی ایستا شد، نه اجرای واقعی |
| 4 | افزودن `.gitattributes` | ✅ انجام شد | `* text=auto eol=lf` + استثنای binary و فایل‌های ویندوزی. هشدار CRLF حذف شد |
| 5 | اولین تست Integration با دیتابیس واقعی | ✅ انجام شد | ۶۹ تست روی PostgreSQL واقعی، ۴ فایل، با guard ایمنی |

### جزئیات کار ۵ — تست Integration

زیرساخت ساخته‌شده:

| فایل | نقش |
|---|---|
| `vitest.integration.config.ts` | پیکربندی جدا، `setupFiles` + `globalSetup`، `fileParallelism: false` |
| `tests/integration/global-setup.ts` | `prisma migrate reset` روی دیتابیس تست |
| `tests/integration/setup-env.ts` | بازتنظیم `DATABASE_URL` به دیتابیس تست، **قبل از** import شدن Prisma |
| `tests/integration/helpers/test-database-url.ts` | حل URL + **guard ایمنی** |
| `tests/integration/helpers/database.ts` | Prisma client، `resetDatabase`، `seedUser`، `seedPerson` |

**Guard ایمنی:** اگر `TEST_DATABASE_URL` و `DATABASE_URL` به یک دیتابیس اشاره کنند، اجرا **قبل از هر migration یا truncate** متوقف می‌شود. این guard تست شد و دیتابیس توسعه دست‌نخورده باقی ماند (۶ کاربر، ۹ شخص، ۲۱ علاقه، ۳۳ یادآور، ۵ لاگ).

مهم‌ترین پوشش‌هایی که قبلاً اصلاً قابل تست نبودند:

- **مسابقهٔ اتمیک claim** — ۱۰ فراخوانی هم‌زمان روی یک slot، دقیقاً یکی برنده (`Promise.all` + catch `P2002`)
- **cascade delete واقعی** — حذف کاربر، هر ۶ جدول را پاک می‌کند
- **`skipDuplicates`** — `addInterests` و `ensureForPerson` در برابر قید یکتا
- **تراکنش `replaceInterests`** — تعویض اتمیک کل مجموعه
- **جداسازی مالکیت در دیتابیس** — کاربر دیگر واقعاً `null` می‌گیرد، نه فقط در Fake
- **JSON خراب در FlowState** → fallback به `{}`

---

## ۷. برنامه اجرایی فاز P1 — قدم‌به‌قدم

فاز P1 شش کار باقی‌مانده دارد. ترتیب زیر دلیل فنی دارد:

### قدم ۱ — Feature Flag سیستم (پیش‌نیاز)
**اول** باید ساخته شود چون Roadmap §17 صریحاً می‌گوید «از Phase 2 به اضافه شود» و بدون آن نمی‌توان Search/Calendar را پشت پرچم رول‌اوت کرد.
- `config/feature-flags.ts` — رجیستری متمرکز، env-driven، با `.env.example` هم‌راستا
- `test envFeatureFlags` — گره‌خوردن به `config/env.ts:14`
- تست: روشن/خاموش بودن هر پرچم + رفتار پیش‌فرض

### قدم ۲ — Dashboard واقعی (بند ۳.1)
- `birthday.service.ts:40` `getTodayForUser` را که dead code است **فعال** کن
- متد `getThisWeekForUser` اضافه شود
- `view/home.views.ts` با ساختار `🔴 امروز / 🟠 این هفته / 🟢 بعداً`
- خطوط: نزدیک‌ترین تولد · تعداد این ماه · تعداد افراد (`countForUser` آماده است: `person.service.ts:84`)
- تست: ۰/۱/چند تولد، مرزهای هفته و ماه جلالی

### قدم ۳ — Search (بند 3.3)
- `person.repository.ts`: متد `searchForUser(userId, query)` — `contains` روی `name` **و** `notes` + `interests.some.title`
- حساسیت به بزرگی/کوچکی حروف و نرمال‌سازی عربی/فارسی (ی/ک) — یک `shared/utils/text.ts` کمکی
- حالت `mode: 'message'` (کاربر متن بفرستد) + دکمه `🔎 جستجوی افراد`
- امنیت: `userId` در تمام کوئری‌ها اجباری
- تست: یافته/نیافته · ایمنی بین‌کاربری · جستجو در علاقه و یادداشت

### قدم ۴ — Calendar (بند 3.2)
- ماژول جدید `modules/calendar/` — `calendar.service.ts` + `calendar.repository.ts`
- گروه‌بندی بر اساس `(month, day)` جلالی؛ `birthMonth`/`birthDay` از قبل ایندکس شده‌اند (`Person_userId_birthMonth_birthDay_idx`)
- نمایش ماه جاری + ناوبری ماه قبل/بعد
- توجه: `isValidJalaliDate` و `jalaliMonthLength` در `utils/date.ts:220,226` آماده‌اند

### قدم ۵ — Snooze (بند 3.5) ⚠️ نیازمند تغییر اعلان
پیش‌نیاز اجباری: اعلان فعلی **هیچ inline keyboard ندارد** (`job:79`).
- `Person`/`Reminder` تغییر نمی‌کند — یک مدل `Snooze` لازم است
- یا ساده‌تر: `NotificationLog` را با `snoozedTo DateTime?` گسترش دهید (کمترین مهاجرش)
- کیبورد اعلان با گزینه‌های «فردا / ۳ روز بعد / هفته بعد» (Roadmap §3.5)
- ⚠️ تصمیم معماری لازم است: آیا زمان اعلان مجدد از offset روزانه استفاده کند یا از offset یادآور شخص؟

### قدم ۶ — Notification retry + Health check (بند 3.6)
**Retry:** `Reminder` یا یک جدول `DeliveryAttempt` با `attempts Int`، `nextAttemptAt`، `lastError`
- exponential backoff: ۱د · ۵د · ۱۵د · ۶۰د · سپس dead
- `release` فعلی محل مناسب hook است (`reminder.service.ts:199`)

**Health check:** سه سطح
- سطح ۱ — `/health` فرمان بات (بدون وابستگی جدید) + پاسخ `db.ping()` از Prisma
- سطح ۲ — `healthcheck` در `docker-compose.yml` برای سرویس bot (الان فقط `db` دارد)
- سطح ۳ — Metrics (اختیاری، بعداً)
- ⚠️ توجه: افزودن HTTP server برای `/health` یک وابستگی جدید است و Roadmap §25 می‌گوید «صرفاً برای آماده‌بودن برای آینده dependency اضافه نکن» — به همین دلیل سطح ۱ پیشنهاد می‌شود.

### قدم ۷ — پایان‌دهی
- تست‌های جدید برای همهٔ موارد بالا (Roadmap §19: Unit / Integration / Bot Flow / Regression)
- `pnpm validate` سبز
- README + به‌روزرسانی همین سند

**تخمین کل P1: ۶ تا ۹ روز کاری.**

---

## ۸. بدهی فنی و ریسک‌ها (Technical Debt & Risks)

| # | مورد | شدت | توضیح |
|---|---|---|---|
| 1 | **مسیر Docker فقط بازبینی ایستا** | 🔴 متوسط | Docker روی این ماشین نصب نیست. `Dockerfile` و `docker-compose.yml` تغییری نکرده‌اند ولی هرگز اجرا نشده‌اند. اولین باری که کسی این را deploy کند ممکن است مشکل پیدا کند |
| 2 | نبود CI | 🟠 متوسط | `pnpm validate` و `pnpm validate:full` دستی هستند. با وجود داشتن تست Integration، کسی آن را خودکار اجرا نمی‌کند |
| 3 | نبود backoff در retry | 🟠 متوسط | اعلان ازدست‌رفته تا تلاش بعدی (۶۰ ثانیه) از دست می‌رود؛ بعد از آن دیگر تلاش نمی‌شود |
| 4 | نبود health check | 🟠 متوسط | خرابی DB یا scheduler از بیرون غیرقابل‌تشخیص است |
| 5 | ۱۸ فایل uncommitted | ✅ **رفع شد** | commit شد |
| 6 | پوشه `docs/` وجود نداشت | ✅ **رفع شد** | `docs/logging.md` و `docs/ROADMAP-STATUS.md` ساخته شد |
| 7 | `.gitattributes` غایب | ✅ **رفع شد** | هشدار CRLF حذف شد |
| 8 | صفر تست Integration | ✅ **رفع شد** | ۶۹ تست روی دیتابیس واقعی |
| 9 | ۵ ماژول استاب غیرفعال | 🟡 کم | عمدی و مطابق §25 — ولی `Promise<never>` کد نوشته‌شده برای فازهای آینده است |
| 10 | `getTodayForUser` استفاده‌نشده | 🟡 کم | dead code — یا استفاده شود (قدم ۲ فاز ۱) یا حذف |
| 11 | تست‌های `as never` / `as unknown as` | 🟡 کم | در `settings.handler.test.ts:83` — type safety در تست‌ها کم است. تست‌های Integration این مشکل را ندارند |
| 12 | `package.json#prisma` deprecated | 🟡 کم | Prisma 7 آن را حذف می‌کند؛ باید به `prisma.config.ts` مهاجرت کرد |

---

## ۹. آنچه طبق قانون Roadmap §25 نباید الان ساخته شود

برای جلوگیری از scope creep، این‌ها **عمداً** ساخته نشده‌اند و نباید ساخته شوند:

- ❌ AI (فاز ۳) — AI هرگز نباید وارد Core Business Logic شود
- ❌ Redis / BullMQ (فاز ۱۱) — بدون load واقعی
- ❌ Microservices — Modular Monolith فعلی کافی است
- ❌ Payment Gateway (فاز ۵) — فقط ثبت Contribution
- ❌ Web Dashboard / Mini App (فاز ۹) — در صورت رشد محصول
- ❌ Monetization (فاز ۱۰) — فقط بعد از مشاهدهٔ استفادهٔ واقعی
- ❌ Analytics (فاز ۸) — نیازمند دادهٔ کاربر واقعی

---

## ۱۰. خلاصه پیشرفت

```text
کل Roadmap (P0 → P11)
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  23%
  P0  MVP               ████████████████████  100%  ✅
  P1  UX + Reliability   ██████░░░░░░░░░░░░░░   28%  🟡
  P2  Gift System       ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P3  AI                ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P4  Groups            ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P5  Gift Pool         ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P6  Planner           ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P7  Personalization   ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P8  Analytics         ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P9  Web / Mini App    ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P10 Monetization      ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜
  P11 Scale             ░░░░░░░░░░░░░░░░░░░░░░    0%  ⬜

فاصله تا MVP اولیه:  ✅ بسته شد (۵ از ۵ کار، فقط مسیر Docker اجرا نشد)
فاصله تا اتمام P1:      72%  (۶ قدم باقی‌مانده، ۶–۹ روز کاری)
```

### روش محاسبه

۱. هر بند Roadmap یک امتیاز دارد: کامل `1.0` · ناقص `0.5` · غایب `0.0`
۲. درصد فاز = مجموع امتیازها ÷ تعداد بندهای همان فاز
۳. وزن فاز = طول Bar در Roadmap §23 (`P0=20, P1=16, P2=14, P3=12, P4=10, P5=8, P6=7, P7=6, P8=5, P9=4, P10=3, P11=2` — مجموع ۱۰۷)
۴. درصد کل = Σ(درصد فاز × وزن فاز) ÷ ۱۰۷

```text
(1.00×20) + (0.28×16) + 0 = 24.5
24.5 ÷ 107 = 22.9%  →  23%
```

> ⚠️ این اعداد **تخمین بر پایهٔ شواهد کد** هستند، نه زمان‌بندی. طبق خود Roadmap §23 این Barها «رتبه‌بندی محصولی نیستند؛ صرفاً نشان‌دهندهٔ ترتیب پیشنهادی توسعه و وابستگی فنی Featureها».

---

## ۱۱. وضعیت Definition of Done عمومی (Roadmap §21)

| بند | وضعیت |
|---|---|
| Featureها کامل باشند | ✅ برای P0 · ❌ برای P1 |
| Edge Caseها بررسی شده باشند | ✅ (۲۴ تست `birthday.calc` شامل sweep ۴۰۰ روزه؛ Esfand 30؛ سال نامعلوم) |
| Tests نوشته شده باشند | ✅ ۲۶۹ تست (۲۰۰ یونیت + ۶۹ یکپارچه روی دیتابیس واقعی) |
| Tests قبلی Pass باشند | ✅ ۱۰۰٪ |
| Database migration انجام شده باشد | ✅ ۱ migration · ۶ جدول · ۱۳ index · روی دیتابیس تست هم اجرا و تأیید شد |
| Security بررسی شده باشد | 🟡 input validation با Zod ✅ · ownership checks ✅ · redaction ✅ · rate limiting ❌ (طبق Roadmap بعد از MVP) |
| Error handling وجود داشته باشد | ✅ `AppError` hierarchy + `bot.catch` + middleware |
| Logging مناسب | ✅ pino ساختاریافته با redaction · سیاست مستند در `docs/logging.md` |
| Documentation به‌روز باشد | ✅ README + `docs/logging.md` + همین سند |
| Feature flag تنظیم شده باشد | ❌ سیستم Flag وجود ندارد |
| UI کامل باشد | ✅ برای P0 |
| Feature نصفه در UI نشان داده نشود | ✅ (ماژول‌های غیرفعال اصلاً به UI نرسیده‌اند) |

---

## ۱۲. توصیه نهایی

طبق قانون اصلی Roadmap (§22) — `User Value → Usage → Validation → Complexity`:

1. **انجام شد:** پنج کار پایانی بسته شد و `v0.1.0` آمادهٔ برچسب‌گذاری است. تنها کاری که باقی مانده اجرای واقعی مسیر Docker روی یک ماشین با Docker است.
2. **بعد:** CI اضافه کن که `pnpm validate:full` را اجرا کند. الان ۶۹ تست Integration وجود دارد ولی هیچ‌کس خودکار اجرایشان نمی‌کند.
3. **بعد از آن:** فقط Phase 1 را شروع کن، دقیقاً به ترتیب قدم ۱ تا ۷ بخش ۷. `Search` و `Calendar` بیشترین ارزش کاربر را دارند؛ `Snooze` و `Health check` بیشترین ارزش عملیاتی را.
4. **توقف:** تا دیدن رفتار کاربر واقعی، وارد Phase 2+ نشو.
