# Yadet — یادت
## Product Roadmap & Phased Development Plan

> **Product:** Yadet — یادت  
> **Type:** Telegram Birthday Assistant  
> **Architecture:** Modular Monolith  
> **Primary Stack:** TypeScript + Node.js + grammY + PostgreSQL + Prisma  
> **Current Stage:** MVP  
> **AI:** Disabled until Phase 3

---

# 1. هدف این سند

این سند مسیر توسعه Yadet را از یک MVP کوچک و سریع به یک محصول کامل مشخص می‌کند.

قانون اصلی:

> هر فاز باید محصول را واقعاً بهتر و قابل استفاده‌تر کند، بدون اینکه پیچیدگی فنی زودتر از نیاز واقعی وارد پروژه شود.

هر Phase باید:

- مستقل قابل توسعه باشد.
- قابلیت‌های قبلی را خراب نکند.
- تست‌های مربوط به خود را داشته باشد.
- Migrationهای لازم را ایجاد کند.
- Documentation را به‌روز کند.
- قبل از شروع Phase بعدی کاملاً پایدار باشد.

---

# 2. وضعیت فعلی — Phase 0

## Foundation / MVP

### هدف

ساخت اولین نسخه واقعی و قابل استفاده Yadet.

### قابلیت‌ها

#### User Management
- Telegram User
- User settings
- Timezone
- Language foundation

#### People
- افزودن شخص
- ویرایش شخص
- حذف شخص
- مشاهده شخص
- لیست افراد

#### Birthday
- ثبت تاریخ تولد
- محاسبه تولد بعدی
- نمایش تعداد روز باقی‌مانده
- مدیریت سال‌های مختلف
- پشتیبانی از سال کبیسه

#### Interests
- افزودن علاقه‌مندی
- حذف علاقه‌مندی
- نمایش علاقه‌مندی‌ها

#### Notes
- یادداشت شخصی برای هر فرد

#### Reminders
- ۷ روز قبل
- ۳ روز قبل
- ۱ روز قبل
- روز تولد

#### Notifications
- ارسال Telegram notification
- جلوگیری از Notification تکراری

#### Settings
- فعال/غیرفعال کردن یادآوری
- تنظیم Timezone
- تنظیمات پایه

### وضعیت

```text
Phase 0
████████████████████
MVP
```

---

# 3. Phase 1 — تجربه کاربری و پایداری

## هدف

قبل از اضافه کردن Featureهای بزرگ، تجربه استفاده از Yadet را بهتر و سیستم را پایدارتر کنیم.

---

## 3.1 Dashboard بهتر

صفحه اصلی بات:

```text
🎂 تولدهای نزدیک

🔴 امروز
🟠 این هفته
🟢 بعداً
```

نمایش:

- نزدیک‌ترین تولد
- تعداد تولدهای این ماه
- تعداد افراد ذخیره‌شده

---

## 3.2 Birthday Calendar

نمایش تولدهای ماه:

```text
مهر ۱۴۰۵

18 مهر — علی
21 مهر — سارا
27 مهر — محمد
```

---

## 3.3 Search

امکان جستجو:

```text
🔎 جستجوی افراد
```

Search بر اساس:

- نام
- علاقه‌مندی
- یادداشت

---

## 3.4 Improved Reminder Settings

کاربر بتواند برای هر فرد تنظیمات متفاوت داشته باشد:

مثلاً:

```text
علی:
☑️ ۷ روز قبل
☑️ ۳ روز قبل
☑️ ۱ روز قبل

سارا:
☐ ۷ روز قبل
☑️ ۱ روز قبل
☑️ روز تولد
```

---

## 3.5 Snooze

از داخل Notification:

```text
⏰ یادآوری دوباره
```

گزینه‌ها:

```text
فردا
۳ روز بعد
هفته بعد
```

---

## 3.6 Reliability

اضافه شود:

- Health checks
- Better error logging
- Scheduler monitoring
- Notification retry
- Database connection monitoring

---

## 3.7 Phase 1 Definition of Done

- [ ] Search
- [ ] Calendar
- [ ] Dashboard بهتر
- [ ] Reminder customization
- [ ] Snooze
- [ ] Notification retry
- [ ] Health check
- [ ] تست کامل Featureهای جدید
- [ ] Update README

---

# 4. Phase 2 — Gift Intelligence بدون AI

## هدف

Yadet از یک Reminder Bot به یک Birthday Assistant تبدیل شود.

در این مرحله هنوز AI نداریم.

---

# 4.1 Gift Ideas

کاربر بتواند برای هر شخص:

```text
🎁 ایده‌های کادو
```

ثبت کند.

مثلاً:

```text
🎁 ایده‌ها

⌚ ساعت
🎧 هدفون
🎮 بازی
📚 کتاب
```

---

# 4.2 Gift History

ثبت کادوهایی که قبلاً برای شخص خریداری شده‌اند.

مثلاً:

```text
🎁 کادوهای قبلی

۱۴۰۳ — هدفون
۱۴۰۴ — کیف
۱۴۰۵ — ...
```

هدف:

> جلوگیری از خرید کادوهای تکراری.

---

# 4.3 Wishlist

برای هر شخص:

```text
❤️ Wishlist
```

موارد:

- اضافه کردن
- حذف کردن
- علامت‌گذاری به عنوان خریداری‌شده

---

# 4.4 Budget

کاربر بتواند بودجه تعیین کند:

```text
💰 بودجه:
2,000,000 تا 5,000,000 تومان
```

---

# 4.5 Static Gift Recommendation

بدون AI.

بر اساس دسته‌بندی:

```text
Gaming
Books
Music
Sports
Technology
Fashion
Food
```

پیشنهادهای از قبل تعریف‌شده ارائه شود.

---

# 4.6 Phase 2 Definition of Done

- [ ] Gift Ideas
- [ ] Gift History
- [ ] Wishlist
- [ ] Budget
- [ ] دسته‌بندی علاقه‌مندی‌ها
- [ ] پیشنهادهای Static
- [ ] تست
- [ ] Migration
- [ ] Documentation

---

# 5. Phase 3 — AI Layer

## هدف

اضافه کردن AI به بخش‌هایی که واقعاً ارزش ایجاد می‌کنند.

AI نباید وارد Core Business Logic شود.

---

# 5.1 AI Architecture

ساختار:

```text
AIService
    │
    ├── GiftSuggestionService
    ├── BirthdayMessageService
    └── StoryCaptionService
```

Provider abstraction:

```text
AIProvider
    │
    ├── OpenAI
    ├── Gemini
    └── Other providers
```

Provider باید قابل تعویض باشد.

---

# 5.2 AI Gift Suggestions

Input:

```text
Person
Interests
Budget
Gift History
Wishlist
```

Output:

```text
🎁 پیشنهادهای کادو

1. ...
2. ...
3. ...
```

AI نباید پیشنهادهایی خارج از Budget را بدون هشدار ارائه کند.

---

# 5.3 Birthday Message Generator

ورودی:

```text
Relationship
Person Name
Tone
Age
Notes
```

Tone:

```text
❤️ احساسی
😂 خنده‌دار
😊 صمیمی
🧑‍💼 رسمی
✨ کوتاه
```

---

# 5.4 Story Caption

تولید:

- Instagram Story text
- Telegram status
- Caption

---

# 5.5 Personalization

در صورت رضایت کاربر، AI از اطلاعات ذخیره‌شده استفاده کند.

مثلاً:

```text
علاقه‌ها
کادوهای قبلی
یادداشت‌ها
رابطه
```

اما:

> اطلاعات خصوصی نباید بدون نیاز به Provider خارجی ارسال شود.

برای این قسمت Privacy Policy لازم است.

---

# 5.6 AI Cost Control

از ابتدا:

- Rate limit
- Token limits
- Request limits
- Usage tracking
- Error handling
- Provider fallback

پیاده‌سازی شود.

---

# 5.7 Phase 3 Definition of Done

- [ ] AI abstraction
- [ ] Provider abstraction
- [ ] Gift suggestions
- [ ] Birthday message
- [ ] Story caption
- [ ] Usage limits
- [ ] Rate limiting
- [ ] AI logging
- [ ] Privacy controls
- [ ] Tests

---

# 6. Phase 4 — Group Birthday

## هدف

Yadet از یک ابزار شخصی به ابزار گروهی تبدیل شود.

---

# 6.1 Telegram Groups

کاربر بتواند Yadet را به گروه اضافه کند.

مثلاً:

```text
گروه:
رفقای دانشگاه
```

---

# 6.2 Group Birthdays

در گروه:

```text
🎂 تولدهای این ماه

18 مهر — علی
25 مهر — سارا
```

---

# 6.3 Birthday Announcement

در روز تولد:

```text
🎉 امروز تولد علی هست!

تیم Yadet تولدت رو تبریک میگه ❤️
```

قابل فعال/غیرفعال شدن توسط Admin گروه.

---

# 6.4 Privacy

اطلاعات خصوصی Person نباید خودکار داخل گروه نمایش داده شود.

Group فقط اطلاعاتی را نمایش دهد که صاحب اطلاعات اجازه داده است.

---

# 7. Phase 5 — Group Gift Pool

## هدف

مدیریت خرید مشترک برای تولد.

---

# 7.1 Create Gift Pool

مثلاً:

```text
🎁 کادوی تولد علی

هدف:
6,000,000 تومان
```

---

# 7.2 Members

اعضا:

```text
Omid — 1,000,000
Sara — 1,500,000
Reza — 500,000
```

---

# 7.3 Progress

```text
████████░░ 50%

3,000,000 / 6,000,000
```

---

# 7.4 Contribution

هر عضو بتواند سهم خودش را ثبت کند.

---

# 7.5 Privacy Options

امکان:

```text
نمایش نام + مبلغ
نمایش نام بدون مبلغ
ناشناس
```

---

# 7.6 Payment

در ابتدا:

> فقط ثبت Contribution

پرداخت واقعی را تا زمانی که نیاز واقعی ایجاد نشده اضافه نکن.

بعداً می‌توان:

- Payment Gateway
- Settlement
- Refund
- Payment verification

را اضافه کرد.

---

# 8. Phase 6 — Advanced Birthday Planner

## هدف

Yadet تبدیل به Birthday Planning Assistant شود.

---

# 8.1 Birthday Checklist

برای هر تولد:

```text
🎂 تولد علی

☑️ انتخاب کادو
☐ خرید کادو
☐ خرید کیک
☐ هماهنگی دوستان
☐ نوشتن پیام
☐ رزرو رستوران
```

---

# 8.2 Custom Tasks

کاربر بتواند Task اضافه کند.

---

# 8.3 Important Dates

علاوه بر Birthday:

```text
❤️ Anniversary
💍 Wedding Anniversary
🤝 Friendship Anniversary
📅 Custom Event
```

---

# 8.4 Recurring Events

تمام Eventها باید امکان Recurrence داشته باشند.

---

# 9. Phase 7 — Smart Personalization

## هدف

Yadet اطلاعات سال‌های گذشته را به ارزش واقعی تبدیل کند.

---

# 9.1 Birthday History

مثلاً:

```text
علی

۱۴۰۳:
🎁 هدفون

۱۴۰۴:
🎁 کیف

۱۴۰۵:
🎁 ساعت
```

---

# 9.2 Preference Evolution

ثبت تغییر علاقه‌ها در طول زمان.

مثلاً:

```text
Gaming
↓
Technology
↓
Photography
```

---

# 9.3 Gift Avoidance

سیستم هشدار دهد:

```text
⚠️ این کادو مشابه چیزی است که سال گذشته برای علی خریدی.
```

---

# 9.4 Personal Birthday Profile

برای هر شخص:

```text
👤 علی

🎂 18 مهر

❤️ علاقه‌ها
🎁 کادوهای قبلی
❤️ Wishlist
💰 Budget
📝 Notes
📅 تاریخچه تولد
```

---

# 10. Phase 8 — Analytics

## هدف

شناخت رفتار کاربران و بهبود محصول.

---

# 10.1 Product Metrics

Track:

```text
Users
Active Users
People Created
Birthdays Added
Reminder Delivery Rate
Reminder Open/Interaction
Gift Features Usage
AI Usage
Group Usage
```

---

# 10.2 User Retention

بررسی:

```text
D1
D7
D30
```

---

# 10.3 Feature Usage

بررسی اینکه کاربران بیشتر از کدام قابلیت استفاده می‌کنند.

---

# 10.4 Privacy

Analytics نباید اطلاعات شخصی غیرضروری جمع کند.

---

# 11. Phase 9 — Web Dashboard

## هدف

در صورت رشد محصول، رابط وب مکمل Telegram ایجاد شود.

---

# 11.1 Dashboard

نمایش:

```text
🎂 Upcoming Birthdays
👥 People
🎁 Gifts
❤️ Wishlist
⏰ Reminders
```

---

# 11.2 Authentication

Telegram Login / Telegram Mini App authentication.

---

# 11.3 Telegram Mini App

در صورت مناسب بودن محصول:

```text
Telegram
    ↓
Yadet Mini App
```

برای عملیات پیچیده‌تر مانند:

- Calendar
- Gift management
- Group management
- Analytics

---

# 12. Phase 10 — Monetization

این Phase فقط بعد از مشاهده استفاده واقعی کاربران بررسی شود.

---

# احتمالات

```text
Free
Premium
```

Premium می‌تواند شامل:

- تعداد افراد بیشتر
- Reminderهای بیشتر
- AI بیشتر
- Group Gift
- Advanced planning
- History
- Personalization

باشد.

---

# 13. Phase 11 — Scale

فقط زمانی اجرا شود که Load واقعی نیاز به آن را نشان دهد.

---

# ابتدا:

```text
Node.js
PostgreSQL
Scheduler
```

سپس در صورت نیاز:

```text
Redis
↓
BullMQ
↓
Worker
```

و در مقیاس بالاتر:

```text
Bot Service
Worker Service
API
Database
Redis
```

Microservices فقط زمانی اضافه شوند که واقعاً مشکل معماری ایجاد شده باشد.

---

# 14. توسعه Infrastructure

با رشد پروژه:

### Phase A

```text
Docker
PostgreSQL
```

### Phase B

```text
Redis
BullMQ
```

### Phase C

```text
Monitoring
Metrics
Alerts
```

### Phase D

```text
Horizontal scaling
Workers
Load balancing
```

---

# 15. Security Roadmap

امنیت باید همزمان با رشد محصول توسعه پیدا کند.

## MVP

- Input validation
- Ownership checks
- Secret management
- Safe logging
- Database constraints

## بعداً

- Rate limiting
- Abuse detection
- Telegram update validation
- Advanced audit logs
- Data export
- Data deletion
- Privacy controls

## در مقیاس بالا

- Security monitoring
- WAF
- Advanced access control
- Encryption strategy
- Incident response

---

# 16. Data & Privacy Roadmap

Yadet اطلاعات شخصی درباره افراد ذخیره می‌کند.

بنابراین با رشد محصول باید:

- Privacy Policy
- Data deletion
- Account deletion
- Data export
- Data retention policy
- AI data controls

اضافه شوند.

کاربر باید بتواند اطلاعات خود را حذف کند.

---

# 17. Feature Flags

از Phase 2 به بعد Feature Flag اضافه شود.

مثلاً:

```text
GIFTS_ENABLED=false
GROUPS_ENABLED=false
AI_ENABLED=false
WISHLIST_ENABLED=false
```

Featureهایی که هنوز آماده نیستند:

> نباید در UI نمایش داده شوند.

---

# 18. Migration Rule

هر Feature که Database را تغییر می‌دهد باید:

```text
Schema
↓
Migration
↓
Repository
↓
Service
↓
Tests
↓
UI
```

داشته باشد.

هیچ Featureای نباید مستقیماً Database را بدون Migration تغییر دهد.

---

# 19. Testing Strategy

هر Phase باید تست داشته باشد.

## Unit

Business logic.

## Integration

Database + Services.

## Bot Flow

Critical Telegram workflows.

## Regression

تمام تست‌های Phaseهای قبلی باید همچنان Pass باشند.

---

# 20. Release Strategy

هر Phase را به Releaseهای کوچک تقسیم کن.

مثلاً:

```text
v0.1.0
MVP

v0.2.0
UX Improvements

v0.3.0
Gift System

v0.4.0
AI

v0.5.0
Groups

v0.6.0
Gift Pool

v0.7.0
Birthday Planner

v0.8.0
Personalization

v0.9.0
Analytics

v1.0.0
Stable Product
```

Versionها فقط نمونه هستند و بر اساس توسعه واقعی تغییر کنند.

---

# 21. Definition of Done برای هر Phase

هیچ Phaseای Done محسوب نمی‌شود مگر اینکه:

- [ ] Featureها کامل باشند.
- [ ] Edge Caseها بررسی شده باشند.
- [ ] Tests نوشته شده باشند.
- [ ] Tests قبلی Pass باشند.
- [ ] Database migration انجام شده باشد.
- [ ] Security بررسی شده باشد.
- [ ] Error handling وجود داشته باشد.
- [ ] Logging مناسب وجود داشته باشد.
- [ ] Documentation به‌روز شده باشد.
- [ ] Feature flag در صورت نیاز تنظیم شده باشد.
- [ ] UI مربوط به Feature کامل باشد.
- [ ] هیچ Feature نصفه‌ای به کاربر نمایش داده نشود.

---

# 22. مهم‌ترین قانون توسعه Yadet

ترتیب توسعه باید بر اساس این اصل باشد:

```text
User Value
    ↓
Usage
    ↓
Validation
    ↓
Complexity
```

نه:

```text
Complex Architecture
    ↓
Many Features
    ↓
Maybe Users
```

---

# 23. اولویت کلی

اولویت پیشنهادی:

```text
P0
MVP
████████████████████

P1
UX + Reliability
████████████████

P2
Gift System
██████████████

P3
AI
████████████

P4
Groups
██████████

P5
Gift Pool
████████

P6
Birthday Planner
███████

P7
Personalization
██████

P8
Analytics
█████

P9
Web / Mini App
████

P10
Monetization
███

P11
Scale
██
```

این Bars رتبه‌بندی محصولی نیستند؛ صرفاً نشان‌دهنده ترتیب پیشنهادی توسعه و وابستگی فنی Featureها هستند.

---

# 24. دستور به AI Agent

وقتی وارد Phase جدید می‌شوی، Agent باید:

1. Phase فعلی را شناسایی کند.
2. وضعیت واقعی Repository را بررسی کند.
3. Featureهای قبلی را بررسی کند.
4. Database schema فعلی را بررسی کند.
5. Tests فعلی را اجرا کند.
6. Featureهای Phase جدید را طراحی کند.
7. قبل از تغییرات بزرگ، Architecture impact را بررسی کند.
8. Migrationهای لازم را ایجاد کند.
9. Feature را پیاده‌سازی کند.
10. Tests را اضافه کند.
11. Regression tests را اجرا کند.
12. Documentation را به‌روز کند.
13. Build را اجرا کند.
14. Typecheck را اجرا کند.
15. در صورت وجود خطا، قبل از پایان Phase آن‌ها را برطرف کند.

---

# 25. هرگز این کارها را نکن

- Feature آینده را زودتر از Phase خودش فعال نکن.
- AI را قبل از Phase 3 وارد Core نکن.
- بدون نیاز Redis اضافه نکن.
- بدون نیاز Microservice ایجاد نکن.
- Database را بدون Migration تغییر نده.
- Business Logic را داخل Telegram Handler ننویس.
- Feature ناقص را در UI نمایش نده.
- اطلاعات کاربران را بدون نیاز ذخیره نکن.
- اطلاعات شخصی را بی‌دلیل به سرویس‌های خارجی ارسال نکن.
- برای افزایش مقیاس، قبل از وجود مشکل واقعی Architecture را پیچیده نکن.
- صرفاً برای «آماده بودن برای آینده» dependency اضافه نکن.

---

# 26. چشم‌انداز نهایی

Yadet در نهایت باید از این:

```text
🎂 Birthday Reminder
```

به این تبدیل شود:

```text
                    Yadet
                      │
        ┌─────────────┼─────────────┐
        │             │             │
      People       Birthdays      Events
        │             │             │
        └─────────────┼─────────────┘
                      │
                 Reminders
                      │
          ┌───────────┼───────────┐
          │           │           │
        Gifts      Wishlist     Messages
          │           │           │
          └───────────┼───────────┘
                      │
                    Groups
                      │
                 Gift Pool
                      │
                     AI
                      │
               Personalization
```

اما این معماری باید **مرحله‌به‌مرحله** ساخته شود.

هدف این نیست که از روز اول همه این‌ها ساخته شوند.

هدف این است:

> **Yadet را کوچک شروع کن، واقعی منتشر کن، رفتار کاربران را ببین و فقط چیزی را که ارزش اثبات‌شده دارد توسعه بده.**