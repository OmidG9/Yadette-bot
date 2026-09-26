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
| `pnpm test` | تست‌ها (vitest) |
| `pnpm lint` / `pnpm format` | eslint / prettier |
| `pnpm typecheck` | فقط بررسی تایپ |
| `pnpm db:generate` | ساخت Prisma Client |
| `pnpm db:migrate` | اعمال migration |

## تست

```bash
pnpm test
```

تست‌های موجود روی منطق قطعی متمرکزند: تبدیل و parse تاریخ، محاسبه تکرار سالانه، انتخاب یادآوری‌های due بر اساس منطقه زمانی، و claim/release برای جلوگیری از ارسال تکراری.

## فاز بعد

ماژول‌های `gifts`، `groups`، `wishlist`، `messages` و `ai` به‌صورت غیرفعال رزرو شده‌اند. برای مقیاس افقی، `Scheduler` و `BirthdayReminderJob` طوری نوشته شده‌اند که جایگزینی با BullMQ فقط تغییر محل اجرا باشد.
