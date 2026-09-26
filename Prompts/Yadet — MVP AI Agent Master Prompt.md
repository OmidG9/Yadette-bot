# Yadet (یادت) — Telegram Birthday Assistant
## Production-Ready MVP Implementation Specification

You are a senior full-stack TypeScript engineer and software architect.

Your task is to **fully implement the Yadet (یادت) Telegram Bot MVP** according to this specification.

The goal is NOT to build a prototype or a throwaway demo.

Build a **small, production-ready, maintainable MVP** with a clean modular architecture that can evolve into a much larger product without requiring a major rewrite.

---

# 1. Product Definition

**Product name:** Yadet  
**Persian name:** یادت  
**Product type:** Telegram Birthday Assistant

Core concept:

> Help users remember the birthdays of people who matter to them.

The MVP must focus only on the essential birthday-management workflow.

The bot should allow a user to:

- Add people
- Store their birthdays
- Store basic interests/notes
- View upcoming birthdays
- Receive birthday reminders
- Edit people
- Delete people
- Configure reminder timing
- View birthday details
- Manage their own settings

AI is explicitly OUT OF SCOPE for MVP.

Do NOT implement any AI integration in this version.

However, the architecture must make future AI integration easy.

---

# 2. Core Product Philosophy

Yadet should feel:

- Simple
- Fast
- Friendly
- Minimal
- Reliable
- Telegram-native

Do not over-engineer the MVP.

Do NOT build:

- Microservices
- Kubernetes
- Event-driven distributed architecture
- Complex frontend
- Payment system
- AI
- Recommendation engine
- Vector database
- External analytics platform
- Complex admin panel

Use a **Modular Monolith**.

---

# 3. Technology Stack

Use exactly this stack unless there is a strong technical reason to change something:

### Runtime
- Node.js
- TypeScript

### Telegram
- grammY

### Database
- PostgreSQL

### ORM
- Prisma

### Validation
- Zod

### Package Manager
- pnpm

### Testing
- Vitest

### Logging
- Pino

### Configuration
- dotenv / validated environment configuration

### Deployment
- Docker
- Docker Compose

For MVP, Redis and BullMQ are NOT required.

The architecture should leave room to introduce Redis/BullMQ later.

---

# 4. Architecture

Use a Modular Monolith architecture.

Recommended structure:

```text
src/
│
├── bot/
│   ├── commands/
│   ├── callbacks/
│   ├── conversations/
│   ├── keyboards/
│   ├── middleware/
│   └── bot.ts
│
├── modules/
│   │
│   ├── users/
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.types.ts
│   │   └── index.ts
│   │
│   ├── people/
│   │   ├── person.service.ts
│   │   ├── person.repository.ts
│   │   ├── person.types.ts
│   │   └── index.ts
│   │
│   ├── birthdays/
│   │   ├── birthday.service.ts
│   │   ├── birthday.repository.ts
│   │   ├── birthday.types.ts
│   │   └── index.ts
│   │
│   ├── reminders/
│   │   ├── reminder.service.ts
│   │   ├── reminder.scheduler.ts
│   │   ├── reminder.repository.ts
│   │   └── index.ts
│   │
│   ├── settings/
│   │   ├── settings.service.ts
│   │   ├── settings.repository.ts
│   │   └── index.ts
│   │
│   ├── gifts/
│   │   ├── gift.service.ts
│   │   └── index.ts
│   │
│   ├── groups/
│   │   ├── group.service.ts
│   │   └── index.ts
│   │
│   ├── wishlist/
│   │   ├── wishlist.service.ts
│   │   └── index.ts
│   │
│   ├── messages/
│   │   ├── message.service.ts
│   │   └── index.ts
│   │
│   └── ai/
│       ├── ai.service.ts
│       └── index.ts
│
├── database/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── client.ts
│
├── jobs/
│   └── birthday-reminder.job.ts
│
├── shared/
│   ├── errors/
│   ├── constants/
│   ├── utils/
│   ├── types/
│   └── logger/
│
├── config/
│   └── env.ts
│
└── main.ts
```

You may adjust the exact structure if necessary, but preserve the architectural principles.

---

# 5. Disabled Future Features

Create the basic module boundaries for future features, but DO NOT implement them.

These modules should exist in a disabled/inactive state:

```text
gifts
groups
wishlist
messages
ai
```

They must not appear as active user features in the MVP.

Do not create fake implementations.

If necessary, expose only interfaces/placeholders.

For example:

```text
modules/ai/
    ai.service.ts
```

can contain a future-facing interface such as:

```ts
export interface AIService {
  generateGiftIdeas(): Promise<never>;
  generateBirthdayMessage(): Promise<never>;
}
```

But do not call it anywhere.

The goal is architectural readiness, not unnecessary implementation.

---

# 6. Database Design

Use Prisma + PostgreSQL.

Design the schema cleanly and with proper indexes.

Minimum entities:

## User

Fields:

- id
- telegramId
- username nullable
- firstName nullable
- lastName nullable
- timezone
- language
- reminderEnabled
- createdAt
- updatedAt

`telegramId` must be unique.

---

## Person

Represents a person whose birthday the user wants to remember.

Fields:

- id
- userId
- name
- birthDate
- notes nullable
- createdAt
- updatedAt

Relationships:

```text
User 1 ──── N Person
```

Add appropriate indexes.

---

## Interest

Represents a simple interest belonging to a person.

Fields:

- id
- personId
- title
- createdAt

Relationship:

```text
Person 1 ──── N Interest
```

Examples:

```text
Gaming
Football
Books
Coffee
Cars
Music
```

This is NOT an AI recommendation system.

It is simply stored information for future features.

---

## Reminder

Fields:

- id
- userId
- personId
- daysBefore
- enabled
- createdAt
- updatedAt

Example:

```text
7 days before
3 days before
1 day before
0 days before
```

The system must support multiple reminders for the same person.

---

## NotificationLog

Create a lightweight notification log to prevent duplicate notifications.

Fields:

- id
- userId
- personId
- birthdayYear
- daysBefore
- sentAt

Create a uniqueness constraint that prevents sending the same reminder twice.

---

# 7. Birthday Date Handling

Birthday reminders are recurring yearly events.

The stored birth date represents:

```text
month + day
```

The original birth year may optionally be stored if the user provides it.

Do NOT incorrectly calculate birthdays as one-time events.

Example:

If:

```text
birthDate = 1998-10-15
```

the birthday occurs every year on:

```text
October 15
```

The reminder engine must calculate the next occurrence correctly.

---

# 8. Timezone

Timezone support is important.

Default timezone:

```text
Asia/Tehran
```

But users must be able to configure their timezone later.

At minimum:

```text
timezone
```

must exist on the User model.

The reminder system must use the user's timezone rather than blindly assuming server time.

Do not hard-code Tehran into business logic.

---

# 9. Telegram UX

The bot must use Telegram inline/reply keyboards wherever appropriate.

Main menu:

```text
🎂 تولدها
👥 افراد من
➕ افزودن شخص
⚙️ تنظیمات
```

Keep the interface simple.

Do not overwhelm the user with commands.

---

# 10. /start

When the user sends:

```text
/start
```

create the user if they do not already exist.

Then show a welcome message.

Example tone:

```text
🎂 به یادت خوش اومدی!

یادت کمک می‌کنه تولد آدم‌های مهم زندگیت رو فراموش نکنی.

از همین الان می‌تونی اولین نفر رو اضافه کنی.
```

Then show the main menu.

If the user already exists, do not duplicate the user.

---

# 11. Add Person Flow

The main MVP workflow is:

```text
➕ افزودن شخص
        ↓
Name
        ↓
Birthday
        ↓
Optional interests
        ↓
Optional notes
        ↓
Reminder settings
        ↓
Confirmation
```

Example:

```text
اسمش چیه؟
```

User:

```text
علی
```

Then:

```text
🎂 تاریخ تولد علی رو وارد کن.

مثال:
18 مهر 1380

یا:
2001-10-10
```

Support Persian-friendly date input.

The system should normalize the date internally.

If the date is invalid:

```text
❌ تاریخ وارد شده معتبر نیست.

مثلاً:
18 مهر 1380
```

Do not silently accept invalid dates.

---

# 12. Interests

After birthday:

```text
❤️ چه چیزهایی دوست داره؟

می‌تونی چند مورد بنویسی، مثلاً:

گیم، فوتبال، قهوه، ماشین
```

Allow skipping this step.

Store interests separately.

The user should be able to add/remove interests later.

---

# 13. Notes

Optional.

Example:

```text
📝 نکته‌ای درباره علی هست که دوست داری یادت بمونه؟
```

Allow:

```text
رد کردن
```

Notes can contain free text.

Do not expose private notes publicly in groups.

---

# 14. Reminder Configuration

Default reminders:

```text
7 days before
3 days before
1 day before
birthday day
```

Allow the user to configure this later.

For MVP, a simple settings interface is sufficient.

Example:

```text
⏰ یادآوری تولد علی

☑️ ۷ روز قبل
☑️ ۳ روز قبل
☑️ ۱ روز قبل
☑️ روز تولد
```

Use inline buttons to toggle them.

---

# 15. People List

When user selects:

```text
👥 افراد من
```

show their people.

Sort by next upcoming birthday.

Example:

```text
🎂 تولدهای پیش‌رو

1. علی
📅 18 مهر
⏳ 12 روز دیگه

2. سارا
📅 2 آبان
⏳ 27 روز دیگه
```

Do not sort by original birth year.

Sort by next birthday occurrence.

---

# 16. Person Details

When selecting a person:

```text
👤 علی

🎂 تولد: 18 مهر
⏳ 12 روز دیگه

❤️ علایق:
• گیم
• فوتبال
• قهوه

📝 یادداشت:
...
```

Buttons:

```text
✏️ ویرایش
❤️ علایق
⏰ یادآوری
🗑 حذف
🔙 بازگشت
```

---

# 17. Edit Person

The user must be able to edit:

- Name
- Birthday
- Interests
- Notes
- Reminder settings

Do not force the user to delete and recreate a person.

---

# 18. Delete Person

Deletion must require confirmation.

Example:

```text
⚠️ مطمئنی می‌خوای «علی» رو حذف کنی؟
```

Buttons:

```text
🗑 بله، حذف کن
❌ لغو
```

Prefer soft-delete architecture if practical.

At minimum, ensure deleted records cannot appear in normal user queries.

---

# 19. Birthday Reminder Job

Implement a lightweight scheduled job.

For MVP, Redis/BullMQ is NOT required.

A simple scheduler is enough.

The job should periodically check:

```text
Upcoming birthdays
```

and send due notifications.

The architecture must allow the scheduler to later be replaced with BullMQ without changing the business logic.

Separate:

```text
Birthday calculation
```

from:

```text
Telegram notification delivery
```

---

# 20. Reminder Message

Example:

```text
🎂 تولد علی نزدیکه!

⏳ فقط ۳ روز مونده.

📅 ۱۸ مهر

❤️ علایق:
گیم، فوتبال، قهوه

یادت نره یه کاری براش بکنی 😉
```

For birthday day:

```text
🎉 امروز تولد علی هست!

🎂 تولدت مبارک علی! ❤️

اگه هنوز براش کاری نکردی، امروز بهترین فرصته.
```

Do not generate AI messages.

These are static/template-based MVP messages.

---

# 21. Duplicate Notification Protection

This is critical.

The same reminder must never be sent twice.

Use `NotificationLog`.

Before sending:

```text
Check notification log
        ↓
Already sent?
   ├── YES → skip
   └── NO  → send
             ↓
          save log
```

Also consider race conditions.

Use database constraints/transactions where appropriate.

---

# 22. Settings

MVP settings:

```text
⚙️ تنظیمات

🔔 یادآوری‌ها
🌍 منطقه زمانی
🗣 زبان
```

Language can initially be:

```text
fa
```

but design the code so localization can be added later.

Do not build a full multilingual system now unless it is trivial.

---

# 23. Error Handling

Never allow an unhandled error to crash the bot.

Use:

- Central error handler
- Structured logging
- User-friendly error messages
- Internal error details only in logs

Example user message:

```text
❌ یه مشکلی پیش اومد.

لطفاً دوباره تلاش کن.
```

Never expose:

- stack traces
- database errors
- SQL
- internal IDs
- environment variables

---

# 24. Security

Implement basic production security from the beginning.

Requirements:

- Validate all user input
- Use Zod where applicable
- Never trust Telegram callback data blindly
- Verify that requested records belong to the current Telegram user
- Prevent IDOR-style access
- Use Prisma parameterized queries
- Do not store bot token in source code
- Use environment variables
- Do not log secrets
- Do not log sensitive user content unnecessarily
- Handle malformed Telegram updates safely

Every Person query must be scoped by:

```text
userId
```

A user must NEVER be able to access another user's people.

---

# 25. Environment Variables

Create:

```text
.env.example
```

At minimum:

```env
BOT_TOKEN=
DATABASE_URL=
DEFAULT_TIMEZONE=Asia/Tehran
LOG_LEVEL=info
NODE_ENV=development
```

Validate environment variables at application startup.

Fail fast if required configuration is missing.

---

# 26. Docker

Create:

```text
Dockerfile
docker-compose.yml
.dockerignore
```

Docker Compose should provide:

```text
yadet-bot
postgres
```

Do not add Redis to the MVP unless technically necessary.

---

# 27. Database Commands

Provide scripts such as:

```json
{
  "dev": "...",
  "build": "...",
  "start": "...",
  "test": "...",
  "test:watch": "...",
  "lint": "...",
  "typecheck": "...",
  "db:migrate": "...",
  "db:generate": "..."
}
```

Use pnpm.

---

# 28. Testing

Do not skip tests.

At minimum write tests for:

### Birthday calculations

Test:

- Birthday today
- Birthday tomorrow
- Birthday next month
- Birthday next year
- Birthday passed this year
- Leap-day birthday handling
- Year boundaries
- Different timezones

### People

Test:

- Create
- Update
- Delete
- User ownership

### Reminders

Test:

- Correct reminder date
- Notification deduplication
- Disabled reminder
- Multiple reminders
- User timezone

### Security

Test that:

```text
User A cannot access User B's Person.
```

---

# 29. Localization Architecture

Even though MVP is Persian-only, do not hard-code every string throughout business logic.

Create a lightweight localization layer:

```text
src/
└── shared/
    └── i18n/
        ├── fa.ts
        └── index.ts
```

Initially only Persian is required.

This makes English/Arabic possible later.

---

# 30. Logging

Use Pino.

Logs should contain useful metadata such as:

```text
event
userId
personId
action
duration
error
```

Do NOT log:

- BOT_TOKEN
- DATABASE_URL
- passwords
- unnecessary private notes
- sensitive personal content

---

# 31. Code Quality

Follow:

- Strict TypeScript
- No `any` unless absolutely unavoidable
- Small functions
- Clear naming
- Separation of concerns
- Dependency injection where useful
- No business logic inside Telegram handlers
- No database queries directly inside Telegram handlers

Bad:

```ts
bot.command("people", async (ctx) => {
  const users = await prisma.person.findMany(...)
});
```

Prefer:

```ts
bot.command("people", async (ctx) => {
  const people = await peopleService.getUpcomingPeople(userId);
});
```

Telegram layer should orchestrate.

Services should contain business logic.

Repositories should handle persistence.

---

# 32. Callback Data

Do not put excessive data into Telegram callback payloads.

Prefer compact identifiers.

Example:

```text
person:view:abc123
person:edit:abc123
person:delete:abc123
```

Validate callback ownership before performing actions.

---

# 33. Future Architecture

The project should be prepared for these future modules:

```text
Phase 2:
🎁 Gift suggestions
💰 Group gift pool
📝 Better birthday messages
📋 Wishlist

Phase 3:
🤖 AI gift suggestions
🤖 AI birthday messages
🤖 Personalized recommendations

Phase 4:
👥 Group birthday management
📊 Analytics
💳 Premium features
🌐 Web dashboard
```

Do not implement these now.

Only make the architecture capable of supporting them.

---

# 34. Important Architectural Rule

Do NOT prematurely create abstractions that have no current purpose.

For example, do not build:

- Generic repository frameworks
- Generic event buses
- CQRS
- Domain event infrastructure
- Microservices
- Complex dependency injection containers

Use simple TypeScript classes/functions/interfaces.

The architecture should be:

```text
Simple now
↓
Modular
↓
Easy to test
↓
Easy to extend
```

---

# 35. UX Requirements

The bot should feel fast.

Avoid unnecessary messages.

Prefer editing existing Telegram messages when appropriate instead of sending many new messages.

Use:

- Inline keyboards
- Back buttons
- Cancel buttons
- Confirmation dialogs
- Clear Persian copy

Every multi-step flow must support:

```text
❌ لغو
```

The user should never get trapped inside a conversation.

---

# 36. Conversation State

For multi-step input flows, use a reliable conversation/state mechanism supported by grammY.

Do not store temporary conversation state only in process memory if that would make the application fragile.

However, keep the implementation simple for MVP.

The state architecture should be replaceable with Redis-backed state later.

---

# 37. Graceful Shutdown

Handle:

```text
SIGTERM
SIGINT
```

Gracefully close:

- Telegram bot
- Prisma connection
- scheduler

Do not leave database connections hanging.

---

# 38. README

Create a comprehensive but practical README containing:

## Project

What Yadet is.

## Features

MVP features.

## Stack

Technology list.

## Setup

```bash
pnpm install
```

Environment setup.

Database setup.

Migration.

Running bot.

## Development

Commands.

## Docker

How to run with Docker Compose.

## Project Architecture

Explain modules.

## Future Features

Mention disabled modules.

---

# 39. Definition of Done

The implementation is NOT complete until all of these are true:

- [ ] Project initializes correctly
- [ ] TypeScript compiles without errors
- [ ] Prisma schema works
- [ ] PostgreSQL migrations work
- [ ] `/start` works
- [ ] User creation works
- [ ] Person creation works
- [ ] Birthday input works
- [ ] Persian date input works
- [ ] Interests work
- [ ] Notes work
- [ ] People list works
- [ ] Upcoming birthday calculation works
- [ ] Person details work
- [ ] Edit works
- [ ] Delete confirmation works
- [ ] Reminder settings work
- [ ] Birthday reminder scheduler works
- [ ] Notification deduplication works
- [ ] Timezone is respected
- [ ] User ownership/security is enforced
- [ ] Error handling exists
- [ ] Logging exists
- [ ] Environment validation exists
- [ ] Docker works
- [ ] Tests exist and pass
- [ ] README is complete
- [ ] Future modules exist as inactive architectural placeholders
- [ ] No AI functionality is implemented
- [ ] No unnecessary MVP features are implemented

---

# 40. Implementation Strategy

Do not attempt to build everything in one giant file.

Implement incrementally in this order:

### Step 1
Initialize project.

### Step 2
Configure TypeScript, ESLint, formatting and environment validation.

### Step 3
Configure Prisma + PostgreSQL.

### Step 4
Create database schema and migrations.

### Step 5
Implement User module.

### Step 6
Implement Person + Interest modules.

### Step 7
Implement Telegram bot and `/start`.

### Step 8
Implement add-person conversation.

### Step 9
Implement people list and person details.

### Step 10
Implement edit/delete.

### Step 11
Implement reminder settings.

### Step 12
Implement birthday calculation engine.

### Step 13
Implement scheduler and notification log.

### Step 14
Implement settings.

### Step 15
Add tests.

### Step 16
Add Docker.

### Step 17
Add README.

### Step 18
Run full validation.

---

# 41. Agent Behavior

Before changing the project:

1. Inspect the existing repository.
2. Identify the current stack.
3. Reuse existing infrastructure if appropriate.
4. Do not blindly overwrite existing files.
5. Preserve working functionality.
6. Explain architectural conflicts before making destructive changes.

If the repository is empty, initialize it according to this specification.

After implementation:

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

and fix all errors.

Also verify:

```text
Prisma generation
Database migration
Docker build
Environment validation
```

Do not claim completion if these checks fail.

---

# 42. Final Deliverable

The final result must be a working Telegram bot named:

# Yadet — یادت

It should provide a polished MVP experience centered around:

```text
👤 People
   ↓
🎂 Birthdays
   ↓
⏰ Reminders
   ↓
🔔 Notifications
```

while keeping future features modular and disabled.

The most important principle:

> **Build the smallest production-quality version of Yadet that people can actually use today, while making tomorrow's features easy to add.**

Do not turn the MVP into an unnecessarily large system.

Do not implement AI.

Do not implement future features.

Do not create fake/demo data.

Do not leave TODOs for functionality explicitly required above.

Implement the actual working product.