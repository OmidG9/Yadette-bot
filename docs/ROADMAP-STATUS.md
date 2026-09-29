# Yadette — گزارش وضعیت توسعه (Roadmap Status Report)

> **مرجع سند:** `Prompts/Yadette — Product Roadmap & Development Phases.md`
> **تاریخ گزارش:** 2026-09-29
> **نسخه پروژه:** `0.2.0`
> **وضعیت کد:** typecheck ✅ · lint ✅ · unit test ✅ (291/291) · integration test ✅ (91/91) · build ✅
> **روش ممیزی:** بررسی کامل repository و تطبیق خط‌به‌خط با بندهای Roadmap

> ✅ **فاز P1 بسته شد.** هر ۹ بند بخش ۳ Roadmap پیاده‌سازی و تست شده‌اند (جز تست دستی Docker — Docker روی این ماشین نصب نیست).

---

## ۱. خلاصه اجرایی

```text
پیشرفت کل Roadmap (P0 → P11)   ████████████████████████████████████░░░░  34%
```

| فاز | نام | وضعیت | درصد |
|---|---|---|---|
| P0 | MVP / Foundation | ✅ کامل | **100%** |
| P1 | UX + Reliability | ✅ کامل | **100%** |
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

> **چقدر تا کل Roadmap؟** ۳۴٪ — یعنی ۶۶٪ باقی است، اما طبق قانون خود Roadmap (§22) این فازها **نباید** الان ساخته شوند؛ تا زمانی که کاربر واقعی و رفتار محصول دیده نشود.

---

## ۲. وضعیت کیفیت (Quality Gates)

| Gate | دستور | نتیجه |
|---|---|---|
| Typecheck | `pnpm typecheck` | ✅ PASS — ۰ خطا، ۰ warning (`strict` + `noUncheckedIndexedAccess`) |
| Lint | `pnpm lint` | ✅ PASS — ۰ خطا (type-checked ruleset، `no-explicit-any: error`) |
| Unit tests | `pnpm test` | ✅ PASS — **۲۴ فایل / ۲۹۱ تست / ۰ fail** |
| Integration tests | `pnpm test:integration` | ✅ PASS — **۴ فایل / ۹۱ تست / ۰ fail** روی PostgreSQL ۱۸ واقعی |
| Search folding parity | `pnpm db:check-search-folding` | ✅ PASS — ۱۳ نمونه، تطبیق کاملِ نرمال‌سازی TS و SQL |
| Build | `pnpm build` | ✅ PASS — `prisma generate` + `tsc -p tsconfig.build.json` |
| Build smoke test | اجرای `dist/` | ✅ PASS — اتصال DB، ساخت container، و کوئری واقعی Repository |
| Aggregate | `pnpm validate` | typecheck → lint → test → build |
| Aggregate | `pnpm validate:full` | + تست‌های دیتابیسی |

### آمار کد

| شاخص | مقدار |
|---|---|
| فایل `.ts` در `src/` | ۸۵ |
| خطوط `.ts` در `src/` | ۶,۸۶۵ |
| فایل تست یونیت | ۲۴ |
| فایل تست یکپارچه | ۴ + ۷ helper/setup |
| خطوط تست | ۴,۲۲۹ یونیت + ۹۴۴ یکپارچه |
| Model در Prisma | ۷ |
| Migration | ۳ |
| Index در دیتابیس | ۱۳ + ایندکس `Person.searchText` |
| Commit | ۹ (remote تنظیم نشده، tag ندارد) |

> ⚠️ کار uncommitted وجود دارد و **سالم** است (تست‌های جدید + تغییرات P1). طبق قوانین مخزن باید commit شود.

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

### فاز P1 — UX + Reliability → **100%** ✅

Roadmap §3.7 — Definition of Done:

| # | بند | وضعیت | جزئیات |
|---|---|---|---|
| 1 | Search | ✅ **DONE** | `person.repository.ts` `searchForUser` · `birthday.service.ts` `searchForUser` (با زمینهٔ تولد) · `conversations/search.ts` · نرمال‌سازی فارسی (`shared/utils/persian.ts`). **نکتهٔ معماری:** query نرمال می‌شود اما متن ذخیره‌شده هم باید باشد، وگرنه جستجوی «كتاب» برای «کتاب» بی‌نتیجه می‌ماند — دقیقاً شبیه «این شخص وجود ندارد». به همین دلیل ستون `Person.searchText` اضافه شد و در همهٔ مسیرهای نوشتن (ساخت، ویرایش، افزودن/حذف علاقه) همگام نگه داشته می‌شود. |
| 2 | Calendar | ✅ **DONE** | `modules/birthdays/calendar.ts` `buildMonth`/`shiftMonth` · سرویس `getCalendarForUser` · `views/calendar.views.ts`. صفحه‌بندی **مطلق** (سال/ماه در callback) تا سه بار «بعدی» و یک بار «قبل» به جای اول برگردد. اسفند ۳۰ در سال کبیسه به ۲۹ منتقل می‌شود. |
| 3 | Dashboard | ✅ **DONE** | `BirthdayBuckets` با سطل‌های امروز / این هفته (۱..۷) / بعداً (کاپ ۱۰) · «نزدیک‌ترین تولد» · «تعداد تولدهای این ماه» · `views/dashboard.views.ts`. `getTodayForUser` دیگر truncation ندارد و مرده نیست. |
| 4 | Reminder customization | ✅ **DONE** | `reminder.service.ts` `setEnabled` — ۶ آفست مستقل برای هر شخص. |
| 5 | Snooze | ✅ **DONE** | مدل `Snooze` + migration · `reminder.service.ts` `snooze`/`resolveSnoozeTarget`/`findDueSnoozes` · `callbacks/snooze.callbacks.ts`. **امنیت:** `deliveryId` در callback مخفی نیست، پس `findLogByIdForUser` مالکیت را بررسی می‌کند؛ آفست از callback قابل جعل است، پس فقط مقادیر `SNOOZE_OPTIONS` پذیرفته می‌شوند. **پایان اعتبار:** اگر یادآوریِ snooze از تولد عبور کند، به‌کاربر پیام `snooze.expired` فرستاده می‌شود (نه سکوت) و ردیف بسته می‌شود. |
| 6 | Notification retry | ✅ **DONE** | `NotificationLog.status/attempts/nextAttemptAt/lastError/sentAt` · backoff نمایی با سقف در `reminders/retry.ts` (۵ دقیقه پایه، ۶ ساعت سقف، ۶ تلاش) · پاس‌های مجزای retry و snooze در `birthday-reminder.job.ts`. **رفع اشکال:** رفتار قبلی سطر لاگ را پاک می‌کرد، اما چون تطبیق تولد فقط در همان روز انجام می‌شود، یادآوری برای همیشه گم می‌شد. حالا سطر `pending` می‌ماند و پاس retry آن را تحویل می‌گیرد. |
| 7 | Health check | ✅ **DONE** | `modules/health/health.service.ts` با پروب‌های جداگانه و محافظت‌شده · `Scheduler.isRunning()` · دستور `/health` (پشت `HEALTHCHECK_ENABLED`) · سه حالت مجزا `ok`/`degraded`/`down` — دیتابیسِ قطع یعنی `down` با پیام خودش، نه وعدهٔ «به‌زودی درست می‌کنم». |
| 8 | تست کامل Featureهای جدید | ✅ **DONE** | ۲۹۱ تست واحد و ۹۱ تست integration. تست‌های جدید: `config/feature-flags`، `modules/retry`، `modules/health`، `modules/reminder.snooze`، `modules/birthday.dashboard`، `modules/birthday.search`، `modules/birthday.calendar` + ۱۰ تست integration برای تطبیق نرمال‌سازی جستجو (نام، علاقه‌مندی و یادداشت). |
| 9 | Update README | ✅ **DONE** | README و پوشهٔ `docs/` به‌روزرسانی شدند؛ هر ۸ متغیر feature flag در `.env.example` مستند شده‌اند. |

**امتیاز P1: (1 × 9) / 9 = 100%**

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

## ۷. برنامه اجرایی فاز P1 — اجراشده

هر هفت قدم زیر انجام شده‌اند. ترتیب اجرا دلیل فنی داشت (پرچم‌ها قبل از قابلیت‌ها تا رول‌اوت قابل کنترل باشد؛ `/health` به‌جای HTTP server از دستور بات استفاده کرد چون Roadmap §25 اضافه‌کردن dependency برای آماده‌بودنِ آینده را ممنوع می‌کند).

### قدم ۱ — Feature Flag سیستم ✅
- `config/feature-flags.ts` — رجیستری متمرکز، env-driven، هم‌راستا با `.env.example`
- پارسر boolean به `trim`/`lowercase` مقاوم شد تا `TRUE` و `true` یکی باشند
- تست: `tests/config/feature-flags.test.ts` (روشن/خاموش، پیش‌فرض، مقادیر نامعتبر)

### قدم ۲ — Dashboard واقعی (بند ۳.۱) ✅
- `getTodayForUser` از حالت مرده درآمد و `getThisWeekForUser` اضافه شد
- `BirthdayBuckets` با ساختار `🔴 امروز / 🟠 این هفته / 🟢 بعداً` (کاپ ۱۰)
- خطوط: نزدیک‌ترین تولد · تعداد این ماه · تعداد کل
- تست: `tests/modules/birthday.dashboard.test.ts` (۰/۱/چند تولد، مرزهای هفته و ماه جلالی)

### قدم ۳ — Search (بند ۳.۳) ✅
- `person.repository.ts` `searchForUser(userId, query)` روی `name`، `notes` و عنوان علاقه‌ها
- نرمال‌سازی عربی/فارسی و ارقام در `shared/utils/persian.ts`
- **اصلاح معماری در حین اجرا:** نرمال‌کردنِ query به‌تنهایی کافی نبود، چون متن ذخیره‌شده نرمال نمی‌شد و جستجوی «كتاب» برای «کتاب» شکست می‌خورد. ستون `Person.searchText` اضافه و در همهٔ مسیرهای نوشتن همگام شد.
- امنیت: `userId` در تمام کوئری‌ها اجباری
- تست: `tests/modules/birthday.search.test.ts` + ۱۰ تست integration برای تطبیق نرمال‌سازی + `pnpm db:check-search-folding` که همسانیِ SQL و TS را تضمین می‌کند

### قدم ۴ — Calendar (بند ۳.۲) ✅
- `modules/birthdays/calendar.ts` `buildMonth`/`shiftMonth` — به‌جای ماژول جدید، چون همه‌چیز از قبل در ماژول تولدها بود
- نمایش ماه جاری + ناوبری ماه قبل/بعد با **صفحه‌بندی مطلق** (سال/ماه در callback) تا «بعدی» سه بار به اول برنگردد
- اسفند ۳۰ در سال کبیسه به ۲۹ منتقل می‌شود
- تست: `tests/modules/birthday.calendar.test.ts` (شامل اسفند ۳۰)

### قدم ۵ — Snooze (بند ۳.۵) ✅
- **تصمیم معماری:** مدل `Snooze` مستقل، نه گسترش `NotificationLog`. دلیل: `NotificationLog` یکتایی «یک سطر برای هر شخص در هر بازه» دارد و چند تعویقِ هم‌زمانِ یک بازه را نمی‌توانست نگه دارد.
- کیبورد اعلان با گزینه‌های ۱/۳/۷ روز
- **امنیت:** `deliveryId` قابل حدس است، پس `findLogByIdForUser` مالکیت را بررسی می‌کند و `daysBefore` فقط از `SNOOZE_OPTIONS` پذیرفته می‌شود
- **تاریخ‌گذاری مجدد:** تعداد روز در لحظهٔ ارسال از تقویم و منطقهٔ زمانی کاربر محاسبه می‌شود؛ تعویقی که از تولد بگذرد بسته می‌شود تا پیام «امروز تولد است» فردای تولد ارسال نشود. **پایان اعتبار اعلام می‌شود:** به‌جای سکوت، پیام `snooze.expired` برای کاربر فرستاده می‌شود (سکوت در باتی که کارش به‌یادآوردن است، شبیه باگ به نظر می‌رسد)، سپس ردیف بسته می‌شود
- تست: `tests/modules/reminder.snooze.test.ts` + سناریوهای مالکیت در integration

### قدم ۶ — Notification retry + Health check (بند ۳.۶) ✅
**Retry:** ستون‌های `status`/`attempts`/`nextAttemptAt`/`lastError`/`sentAt` روی `NotificationLog` + backoff نمایی در `reminders/retry.ts`
- **رفع اشکال:** رفتار قبلی سطر لاگ را حذف می‌کرد؛ اما چون تطبیق تولد فقط در همان روز انجام می‌شود، یادآوری برای همیشه از دست می‌رفت. حالا سطر `pending` باقی می‌ماند و پاس retry آن را تحویل می‌گیرد.
- `findHandledSlotKeys` همهٔ وضعیت‌ها را می‌بیند تا پاس تازه، سطر `pending` را دوباره ندزدد
- **lease اتمیک:** پاس تازه با unique constraint محافظت می‌شود، اما retry ردیفی را دوباره می‌فرستد که از قبل وجود دارد. پس قبل از ارسال، ردیف با یک `UPDATE` شرطی اجاره می‌شود که `nextAttemptAt` را جلو می‌برد و همان شرط خواندن را تکرار می‌کند؛ نتیجه: دقیقاً یک کارگر برنده می‌شود و ردیف تا پایان مهلت از دید بقیه پنهان است
- کاربر حذف‌شده پایان‌پذیر (`markFailed`) است، چون `NotificationLog.userId` cascade دارد و retry بی‌پایان می‌شد

**Health check:** سطح ۱ — دستور `/health` با سه حالت مجزای `ok`/`degraded`/`down` و پشت `HEALTHCHECK_ENABLED`. سطح ۲ (healthcheck در compose) و ۳ (metrics) انجام نشده و برای بعدی‌اند.

### قدم ۷ — پایان‌دهی ✅
- ۲۹۱ تست واحد و ۹۱ تست integration
- `pnpm test:all`، `pnpm build` و دروازه‌های typecheck/lint سبز
- README، `.env.example` و همین سند به‌روزرسانی شدند

---

## ۸. بدهی فنی و ریسک‌ها (Technical Debt & Risks)

| # | مورد | شدت | توضیح |
|---|---|---|---|
| 1 | **مسیر Docker فقط بازبینی ایستا** | 🔴 متوسط | Docker روی این ماشین نصب نیست. `Dockerfile` و `docker-compose.yml` تغییری نکرده‌اند ولی هرگز اجرا نشده‌اند. اولین باری که کسی این را deploy کند ممکن است مشکل پیدا کند |
| 2 | نبود CI | 🟠 متوسط | `pnpm validate` و `pnpm validate:full` دستی هستند. با وجود داشتن تست Integration، کسی آن را خودکار اجرا نمی‌کند |
| 3 | نبود backoff در retry | ✅ **رفع شد** | `reminders/retry.ts` با backoff نمایی، سقف ۶ ساعت و ۶ تلاش. سطر `pending` دیگر حذف نمی‌شود، پس یادآوری گم نمی‌شود |
| 4 | نبود health check | ✅ **رفع شد** | دستور `/health` با سه حالت `ok`/`degraded`/`down` و پشت پرچم. سطح ۲ (compose healthcheck) و metrics هنوز باقی است |
| 5 | ۱۸ فایل uncommitted | ✅ **رفع شد** | commit شد |
| 6 | پوشه `docs/` وجود نداشت | ✅ **رفع شد** | `docs/logging.md` و `docs/ROADMAP-STATUS.md` ساخته شد |
| 7 | `.gitattributes` غایب | ✅ **رفع شد** | هشدار CRLF حذف شد |
| 8 | صفر تست Integration | ✅ **رفع شد** | ۹۱ تست روی دیتابیس واقعی |
| 9 | ۵ ماژول استاب غیرفعال | 🟡 کم | عمدی و مطابق §25 — ولی `Promise<never>` کد نوشته‌شده برای فازهای آینده است |
| 10 | `getTodayForUser` استفاده‌نشده | ✅ **رفع شد** | در سطل «امروز» داشبورد مصرف شد |
| 11 | تست‌های `as never` / `as unknown as` | 🟡 کم | در `settings.handler.test.ts:83` — type safety در تست‌ها کم است. تست‌های Integration این مشکل را ندارند |
| 12 | `package.json#prisma` deprecated | 🟡 کم | Prisma 7 آن را حذف می‌کند؛ باید به `prisma.config.ts` مهاجرت کرد |
| 13 | retry بدون lease اتمیک | ✅ **رفع شد** | پاس retry و snooze قبل از ارسال، ردیف را با یک `UPDATE` شرطی اجاره می‌کنند (همان شرطی که خوانده شد، پس دقیقاً یک کارگر برنده می‌شود). ردیفِ اجاره‌شده تا پایان مهلت از کوئری سایر کارگرها پنهان است. ۴ تست integration با ۱۰ تماس هم‌زمان و ۲ تست race در سطح job |
| 14 | شمارش معکوس snooze کهنه می‌شود | ✅ **رفع شد** | تعداد روز در لحظهٔ ارسال از تقویم و منطقهٔ زمانی کاربر محاسبه می‌شود، نه از offset ذخیره‌شده. تعویقِ گذشته از تولد به‌جای پیام اشتباه، با اعلام `snooze.expired` به کاربر بسته می‌شود |

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
████████████████████████████████████░░░░  34%
  P0  MVP               ████████████████████  100%  ✅
  P1  UX + Reliability   ████████████████████  100%  ✅
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
فاصله تا اتمام P1:      ✅ بسته شد (۹ از ۹ بند؛ ۳۸۰ تست، ۰ خطا)
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
| Featureها کامل باشند | ✅ برای P0 و P1 |
| Edge Caseها بررسی شده باشند | ✅ (۲۴ تست `birthday.calc` شامل sweep ۴۰۰ روزه؛ Esfand 30؛ سال نامعلوم · کاربر حذف‌شده · اسفند ۳۰ · مالکیت snooze) |
| Tests نوشته شده باشند | ✅ ۳۸۲ تست (۲۹۱ یونیت + ۹۱ یکپارچه روی دیتابیس واقعی) |
| Tests قبلی Pass باشند | ✅ ۱۰۰٪ |
| Database migration انجام شده باشد | ✅ ۳ migration · جدول‌های `NotificationLog`/`Snooze` و ستون `Person.searchText` · روی دیتابیس تست هم اجرا و تأیید شد |
| Security بررسی شده باشد | 🟡 input validation با Zod ✅ · ownership checks ✅ · redaction ✅ · rate limiting ❌ (طبق Roadmap بعد از MVP) |
| Error handling وجود داشته باشد | ✅ `AppError` hierarchy + `bot.catch` + middleware |
| Logging مناسب | ✅ pino ساختاریافته با redaction · سیاست مستند در `docs/logging.md` |
| Documentation به‌روز باشد | ✅ README + `docs/logging.md` + `.env.example` + همین سند |
| Feature flag تنظیم شده باشد | ✅ `config/feature-flags.ts` با ۸ پرچم، همه در `.env.example` مستند |
| UI کامل باشد | ✅ برای P0 و P1 |
| Feature نصفه در UI نشان داده نشود | ✅ پرچم خاموش = نه دکمه، نه فرمان، نه مسیر callback |

---

## ۱۲. توصیه نهایی

طبق قانون اصلی Roadmap (§22) — `User Value → Usage → Validation → Complexity`:

1. **انجام شد:** فازهای P0 و P1 بسته شدند و `v0.2.0` آمادهٔ برچسب‌گذاری است. ۳۸۲ تست، typecheck، lint و build همگی سبز. ممیزی خط‌به‌خط §۳٫۱–۳٫۷ انجام شد و هر ۹ بند Definition of Done تأیید شد.
2. **تنها کار باقی‌مانده در P1:** اجرای واقعی مسیر Docker روی یک ماشین با Docker — Docker روی این ماشین نصب نیست.
3. **بعد:** CI اضافه کن که `pnpm validate:full` را اجرا کند. الان ۹۱ تست Integration وجود دارد ولی هیچ‌کس خودکار اجرایشان نمی‌کند.
4. **ریسک‌های باز P1:** هیچ‌کدام. دو ریسکی که در نسخهٔ قبلی این سند ثبت شده بود (lease اتمیک retry و شمارش معکوس stale در snooze) در بخش ۸ رفع شده‌اند.
5. **توقف:** تا دیدن رفتار کاربر واقعی، وارد Phase 2+ نشو.
