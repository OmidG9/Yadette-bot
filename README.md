# Yadette

> دستیار تلگرامی یادته — تولد آدم‌های مهم زندگیت رو فراموش نکن.

یک ربات Telegram برای ثبت تولدها (شمسی)، یادآوری ۷/۳/۱ روز قبل و روز تولد، نگهداری علایق و یادداشت هر شخص.

- بدون AI (در این نسخه) — فقط منطق قطعی و قابل تست
- تاریخ‌ها کاملاً جلالی: «۱۸ مهر ۱۳۸۰» یا «۲ آبان» (بدون سال)
- هر کاربر فقط داده‌های خودش را می‌بیند (مالکیت در سطح query)
- یادآوری تکراری هرگز ارسال نمی‌شود (claim اتمیک روی دیتابیس)

## روشن کردن پروژه محلی

```bash
pnpm install
cp .env.example .env      # BOT_TOKEN را پر کن
docker compose up -d db   # یا یک Postgres دلخواه
pnpm db:migrate
pnpm dev
```

با Docker برای همه‌چیز:

```bash
# در فایل .env فقط BOT_TOKEN را تنظیم کن
docker compose up -d --build
```

compose سه سرویس دارد: `db` (PostgreSQL 16 با healthcheck)، `migrate` (یک‌بار `prisma migrate deploy` می‌زند و تمام می‌شود) و `bot` که بعد از موفقیت migration بالا می‌آید. ایمیج چندمرحله‌ای است: build، migrate، prod-deps و runtime؛ در runtime فقط dev dependencyها حذف شده‌اند، کاربر `node` است و `tini` برای مدیریت سیگنال‌ها استفاده می‌شود.

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `BOT_TOKEN` | — | اجباری، توکن BotFather |
| `DATABASE_URL` | — | اجباری، آدرس PostgreSQL |
| `TEST_DATABASE_URL` | — | فقط برای `pnpm test:integration` (دیتابیس جدا) |
| `DEFAULT_TIMEZONE` | `Asia/Tehran` | منطقه زمانی کاربر جدید |
| `DEFAULT_LANGUAGE` | `fa` | زبان کاربر جدید |
| `REMINDER_CHECK_INTERVAL_MS` | `60000` | فاصله بررسی یادآوری‌ها |
| `LOG_LEVEL` | `info` | سطح لاگ (pino) |

## معماری

Modular monolith: هر ماژول یک دامنه است و فقط از طریق interface با بقیه حرف می‌زند.

```
src/
  main.ts              entrypoint: DB → bot → scheduler → graceful shutdown
  container.ts         composition root (تنها جایی که Prisma شناخته می‌شود)
  bot/                 لایه Telegram: context، middleware، commands، keyboards،
                       views، callbackها و conversationها (state در دیتابیس)
  modules/
    users/             ثبت کاربر و تنظیمات پایه
    people/            افراد، علایق، حذف نرم
    birthdays/         محاسبه تکرار سالانه (Jalali) — خالص و قابل تست
    reminders/         یادآوری‌ها، due detection، claim/release
    settings/          منطقه زمانی، زبان، فعال/غیرفعال یادآوری
    gifts|groups|wishlist|messages|ai/   placeholder غیرفعال برای فاز بعد
  jobs/                ارسال یادآوری در Telegram
  shared/              config، logger، errors، i18n، تاریخ و ابزارها
```

قواعد مهم:

- **تاریخ جلالی مبنای تکرار است.** `Person` ماه/روز/سال جلالی نگه می‌دارد؛ «۳۰ اسفند» در سال‌های غیرکبیسه روی ۲۹ اسفند یادآوری می‌شود.
- **منطقه زمانی کاربر ملاک است.** «امروز» برای هر کاربر در `User.timezone` محاسبه می‌شود.
- **مکالمه‌ها stateless-ish هستند:** وضعیت در جدول `UserFlowState` ذخیره می‌شود، پس ری‌استارت یا چند نمونه (instance) مشکلی ایجاد نمی‌کند.
- **callback data هرگز مستقیم استفاده نمی‌شود:** اول با Zod اعتبارسنجی و بعد به مالکیت رکورد چک می‌شود.
- **جای AI از قبل آماده است:** ماژول `modules/ai` خالی ولی ثبت‌شده است.

## دستورها

| دستور | کار |
| --- | --- |
| `pnpm dev` | اجرا در حالت watch |
| `pnpm build` | بیلد TypeScript |
| `pnpm start` | اجرای بیلد |
| `pnpm test` | تست‌های یکتا (vitest) |
| `pnpm test:integration` | تست‌های دیتابیسی (PostgreSQL واقعی) |
| `pnpm test:all` | هر دو |
| `pnpm lint` / `pnpm format` | eslint / prettier |
| `pnpm typecheck` | فقط بررسی تایپ |
| `pnpm validate` | typecheck + lint + test + build |
| `pnpm validate:full` | همان + تست‌های دیتابیسی |
| `pnpm db:generate` | ساخت Prisma Client |
| `pnpm db:migrate` | اعمال migration |

## تست

```bash
pnpm test              # تست‌های یکتا (بدون دیتابیس)
pnpm test:integration  # تست‌های دیتابیسی (PostgreSQL واقعی)
pnpm test:all          # هر دو
```

**یونیت:** مبدل و parse تاریخ، محاسبه تکرار سالانه، انتخاب یادآوری‌های due بر اساس منطقه زمانی، و claim/release برای جلوگیری از ارسال تکراری. هیچ دیتابیسی لازم نیست و همیشه اجرا می‌شود.

**یکپارچه (Integration):** `tests/integration/` همان Repositoryهای واقعی Prisma را روی یک PostgreSQL واقعی اجرا می‌کند — چیزهایی که با Fake قابل پوشش نیست: مسابقهٔ روی unique constraint، رفتار `skipDuplicates`، تراکنش‌ها، و cascade delete.

قبل از اولین اجرا یک دیتابیس جدا بساز (هرگز همان دیتابیس توسعه نباشد) و `TEST_DATABASE_URL` را در `.env` بگذار:

```bash
createdb -U yadette yadette_test
```

قبل از هر اجرا، migrationها روی این دیتابیس اعمال و جدول‌ها خالی می‌شوند. اگر `TEST_DATABASE_URL` و `DATABASE_URL` یک نام داشته باشند، اجرا **قبل از هر تغییری متوقف می‌شود** تا داده‌های واقعی پاک نشوند.

## نکته ویندوز

`pnpm build` یک `prisma generate` اجرا می‌کند که باید فایل `query_engine-*.dll.node` را جابه‌جا کند. اگر `pnpm dev` هم‌زمان در حال اجرا باشد، ویندوز فایل را قفل نگه می‌دارد و بیلد با `EPERM ... rename` شکست می‌خورد. راه‌حل: `pnpm dev` را متوقف کن، بعد `pnpm build` را اجرا کن.

## مستندات

| فایل | محتوا |
| --- | --- |
| [`docs/ROADMAP-STATUS.md`](docs/ROADMAP-STATUS.md) | وضعیت پیشرفت هر فاز، درصد پیشرفت، و کارهای باقی‌مانده |
| [`docs/logging.md`](docs/logging.md) | سیاست لاگ: چه چیزی مجاز است، چه چیزی ممنوع، و الگوی استاندارد |
| [`Prompts/Yadette — Product Roadmap & Development Phases.md`](Prompts/Yadette%20%E2%80%94%20Product%20Roadmap%20%26%20Development%20Phases.md) | نقشه راه اصلی محصول (P0 تا P11) |

## فاز بعد

ماژول‌های `gifts`، `groups`، `wishlist`، `messages` و `ai` به‌صورت غیرفعال رزرو شده‌اند. برای مقیاس افقی، `Scheduler` و `BirthdayReminderJob` طوری نوشته شده‌اند که جایگزینی با BullMQ فقط تغییر محل اجرا باشد.

فاز بعدی **فاز ۱ (تجربه کاربری و پایداری)** است: Feature Flag، داشبورد تولدهای نزدیک، جستجو، تقویم، Snooze و Health Check. وضعیت دقیق و برنامهٔ اجرایی در [`docs/ROADMAP-STATUS.md`](docs/ROADMAP-STATUS.md).
