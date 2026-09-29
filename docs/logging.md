# سیاست Logging — Yadette

> مرجع پیاده‌سازی: `src/shared/logger/index.ts`

## اصل بنیادی

یک بات تولد، داده شخصی درباره آدم‌های دیگر نگه می‌دارد (اسم، تاریخ تولد، علایق، یادداشت).
بنابراین لاگ نباید این داده‌ها را به فایل یا هر sink خارجی نشت دهد.

> **قانون:** لاگ فقط شناسه، عملیات و مدت‌زمان. **هرگز** متن پیام، نام شخص، یادداشت یا علاقه‌مندی.

## چه چیزی مجاز است

| فیلد | نمونه | چرا |
| --- | --- | --- |
| شناسه عددی کاربر | `userId` | برای عیب‌یابی و پشتیبانی لازم است |
| شناسه رکورد | `personId`, `reminderId` | ردیابی جریان |
| نام عملیات | `db.connected`, `scheduler.task.done` | تشخیص اینکه کدام مرحله شکست خورده |
| مدت‌زمان | `durationMs` | تشخیص کندی |
| شمارش | `count`, `attempt` | تشخیص حجم و retry |
| خطا | `err.type`, `err.message` | تشخیص نوع خطا |

## چه چیزی ممنوع است

| فیلد | دلیل مسدودسازی |
| --- | --- |
| `BOT_TOKEN` | راز مطلق — دسترسی کامل به ربات |
| `DATABASE_URL` | شامل نام کاربر و رمز عبور |
| `req.headers.authorization` | توکن کاربر |
| متن پیام، `notes`، `name`، علاقه‌مندی | داده شخصی شخص ثالث |
| بدنه کامل پاسخ Telegram | می‌تواند داده کاربر را حمل کند |

## پیاده‌سازی

```ts
// src/shared/logger/index.ts
const redactPaths = [
  'token', 'botToken', '*.token', '*.botToken',
  'req.headers.authorization',
  'config.DATABASE_URL', 'DATABASE_URL', 'BOT_TOKEN',
];
```

`pino` با `redact` و `censor: '[REDACTED]'` این مسیرها را **پیش از** نوشتن در لاگ جایگزین می‌کند،
پس حتی اگر کدی به‌اشتباه `logger.info({ BOT_TOKEN })` بزند، راز ذخیره نمی‌شود.

- `base: undefined` → `pid` و `hostname` ثبت نمی‌شوند (کمک به کاهش سطح داده)
- `level` از `LOG_LEVEL` env (پیش‌فرض `info`)
- در توسعه و TTY، خروجی با `pino-pretty` رنگی و با زمان `HH:MM:ss` نمایش داده می‌شود

## الگوی استاندارد در کد

```ts
// خوب — شناسه و نتیجه
logger.info({ userId, daysBefore }, 'reminder.claimed');

// خوب — خطای نوع‌دار، بدون داده کاربر
logger.error({ err, personId }, 'reminder.delivery.failed');

// بد — داده شخصی نشت می‌کند
logger.info({ notes: person.notes }, 'person.updated');
```

## چه زمانی چه چیزی ثبت می‌شود

| رویداد | محل |
| --- | --- |
| راه‌اندازی برنامه | `main.ts:11` — `app.starting`, `db.connected`, `bot.initialized`, `scheduler.started`, `bot.started` |
| خطای اتصال دیتابیس | `database/client.ts:13` — فقط لاگ، اتصال fail-fast نمی‌شود |
| اجرای دوره‌ای scheduler | `reminder.scheduler.ts:75` — `durationMs` |
| شکست یک تسک | `reminder.scheduler.ts:81` — `task.failed` |
| رد شدن به‌خاطر اجرای قبلی | `reminder.scheduler.ts:66` — `scheduler.skipped` |
| خطای عمومی تلگرام | `bot.ts:184-218` — تفکیک `GrammyError` و `HttpError` |
| خطای handler | `bot/middleware/error.ts:32` |

## چطور لاگ‌ها را ببینیم

```bash
pnpm dev            # خروجی رنگی در ترمینال (pino-pretty)
pnpm start          # خروجی JSON روی stdout
```

در production، stdout را به collector سیستم هدایت کنید؛ خود برنامه هیچ فایل لاگی نمی‌نویسد
و هیچ dependency برای مدیریت فایل لاگ ندارد.
