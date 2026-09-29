/**
 * Persian strings (the only locale in the MVP).
 *
 * This is the single place for user-facing copy; business logic contains no
 * hard-coded text. Adding `en.ts` later means adding a locale file plus one
 * entry in `index.ts` — no logic changes.
 *
 * `{{name}}` placeholders are replaced by `t(key, lang, params)`.
 *
 * Voice: friendly and casual ("تو" form), short sentences, no corporate speak.
 * Every screen answers three questions: what is this, what do I do now, and how
 * do I get out of here.
 */
export const fa = {
  common: {
    cancel: '❌ لغو',
    confirm: '✅ تأیید',
    none: 'هیچ‌کدوم',
  },
  buttons: {
    editName: '✏️ اسم',
    editBirthday: '🎂 تاریخ تولد',
    editInterests: '❤️ علایق',
    editNotes: '📝 یادداشت',
    editReminders: '⏰ یادآوری',
    delete: '🗑 حذف',
    back: '🔙 بازگشت',
    home: '🏠 منوی اصلی',
    close: '✖️ بستن',
  },
  /** Shown in the Telegram command menu, so they stay short. */
  commands: {
    start: 'شروع',
    about: 'دربارهٔ بات',
    help: 'راهنما',
    cancel: 'لغو عملیات',
    health: 'وضعیت بات',
  },
  /** The single hint that tells a user how to leave any step. */
  hint: {
    cancel: '🚪 هر وقت خواستی این مرحله رو ول کنی، «❌ لغو» رو بزن.',
    skip: '⏭ اگه چیزی نداری، «⏭ بعدی» رو بزن یا همین‌جا «-» رو بفرست.',
    keyboard: '⌨️ می‌تونی از دکمه‌های پایین صفحه هم استفاده کنی.',
  },
  /** Navigation inside a multi-step flow. */
  nav: {
    back: '⏮ قبلی',
    next: '⏭ بعدی',
  },
  errors: {
    generic: '❌ یه مشکلی پیش اومد. دوباره تلاش کن.',
    notFound: '🔍 پیدا نشد.',
    forbidden: '🚫 به این مورد دسترسی نداری.',
    invalidInput: '❌ این درست نیست. یه بار دیگه بفرست.',
  },
  flow: {
    cancelWord: 'لغو',
    busy: '🧭 این مرحله هنوز بازه 🙂 برای برگشت به منو «❌ لغو» رو بزن.',
    notActive: '⌛ این مرحله تموم شده. دوباره از منو شروع کن 🙂',
    cancelled: '❌ لغو شد. هر وقت خواستی از منو ادامه بده 🙂',
  },
  user: {
    /** Fallback when Telegram gives neither a first name nor a username. */
    dear: 'دوست عزیز',
  },

  menu: {
    title: '🎂 یادته',
    upcoming: '🎂 تولدها',
    addPerson: '➕ افزودن شخص',
    settings: '⚙️ تنظیمات',
    home: '🏠 منوی اصلی',
    help: 'ℹ️ راهنما',
    about: '📖 درباره‌ی یادته',
    /** Phase 1 sections. */
    dashboard: '🏠 خانه',
    search: '🔎 جستجو',
    calendar: '📅 تقویم',
  },
  start: {
    /** First contact: what it does, what it stores, one obvious next step. */
    newUser: [
      '🎂 <b>سلام! من «یادته» هستم.</b>',
      '',
      'کارم ساده‌ست: تولد آدم‌های مهم زندگیت رو نگه می‌دارم و به‌موقع یادت میارم — ۷ روز قبل، ۳ روز قبل، ۱ روز قبل و روز خود تولد.',
      '',
      '<b>چی ثبت می‌کنی؟</b>',
      '• اسم و تولد (شمسی)',
      '• علایق و یادداشتی که کمکت می‌کنه یادت بمونه',
      '',
      '🔒 همه‌چیز توی دیتابیس خودمه و فقط تو می‌بینیش.',
      'هر وقت خواستی، از «⚙️ تنظیمات» می‌تونی همه‌ی اطلاعاتت رو برای همیشه پاک کنی.',
      '',
      'از دکمه‌های زیر هر بخشی رو که می‌خوای باز کن 👇',
    ].join('\n'),
    /** Returning user with at least one person. */
    returning:
      '🎂 خوش اومدی <b>{{name}}</b>!\n\n{{count}} نفر توی «یادته» ثبت شده و هر چیزی که می‌خوای از دکمه‌های زیر در دسترسه 👇',
    /** Returning user who never finished adding someone. */
    empty:
      '🎂 خوش اومدی <b>{{name}}</b>!\n\nهنوز کسی اضافه نکردی. اولین نفر رو بذار توی «یادته» — از «➕ افزودن شخص» شروع کن 👇',
    cta: '➕ اضافه کردن اولین نفر',
    /** Sent when the CTA deep link cannot be built. */
    ctaFallback: 'روی «➕ افزودن شخص» توی منو بزن تا شروع کنیم 🙂',
  },
  about: {
    text: [
      '📖 <b>درباره‌ی یادته</b>',
      '',
      '<b>یادته</b> یه دستیار کوچیکه که تولد آدم‌های مهم زندگیت رو نگه می‌داره و به‌موقع یادت میاره. هدفش ساده‌ست: <b>هیچ تولدی از قلم نیفته</b> و برای گرفتن یه یادآوری مجبور نباشی بی‌خیال کارهایی که واقعاً مهمن.',
      '',
      '<b>🎂 چیکار می‌کنم؟</b>',
      '• تولد هر کس رو با تاریخ شمسی نگه می‌دارم.',
      '• قبل از هر تولد چند بار یادت میارم: ۷ روز قبل، ۳ روز قبل، ۱ روز قبل و روز خود تولد.',
      '• کنار هر تولد، علایق و یادداشتی که کمکت می‌کنه یادت بمونه ذخیره می‌کنم.',
      '• توی «تولدها» همه رو به ترتیب نزدیک‌ترین تولد می‌چینم.',
      '',
      '<b>🧠 چطور کار می‌کنم؟</b>',
      'من با تاریخ‌های شمسی کار می‌کنم و «امروز» رو با منطقه زمانی خودت حساب می‌کنم. تاریخ تولد رو هر جوری راحتی بنویسی می‌فهمم: «۱۸ مهر ۱۳۸۰»، «۲ آبان» یا «2001-10-10». اگه سال نداشتی هم اشکالی نداره؛ سن الانش رو خودم حساب می‌کنم.',
      '',
      '<b>🔒 حریم خصوصی</b>',
      'همه‌چیز توی دیتابیس خودمه و فقط تو می‌بینیش. هیچ‌کس دیگه‌ای به لیستت دسترسی نداره و اطلاعاتت جایی پخش نمی‌شه.',
      'اگه هر وقت خواستی همه‌چیز رو پاک کنی، توی «⚙️ تنظیمات» دکمه‌ی «🗑 حذف همه‌ی اطلاعات من» هست؛ همه‌چیز برای همیشه پاک می‌شه و از نو از صفر شروع می‌کنیم.',
      '',
      '<b>⌨️ چطور باهاش کار کنم؟</b>',
      'از سه دکمه‌ی پایین صفحه استفاده کن:',
      '🎂 <b>تولدها</b> — فهرست نزدیک‌ترین تولدها',
      '➕ <b>افزودن شخص</b> — ثبت اسم، تولد، علایق و یادداشت',
      '⚙️ <b>تنظیمات</b> — روشن/خاموش کردن یادآوری‌ها، منطقه زمانی و حذف اطلاعات',
      '',
      'دستورها هم این‌هاست:',
      '/start — شروع یا برگشت به منو',
      '/about — همین راهنمای کامل',
      '/help — راهنمای سریع',
      '/cancel — لغو کاری که نیمه‌کاره رها کردی',
      '',
      '<b>💡 یه نکته</b>',
      'هر وقت وسط یه مرحله بودی و خواستی رها کنی، «❌ لغو» رو بفرست یا /cancel بزن. اگه چیزی لازم نبود (مثلاً علایق)، «-» رو بفرست تا ردش کنیم.',
      '',
      'همین. حالا یه نفر اضافه کن 🙂',
    ].join('\n'),
  },
  help: {
    text: 'ℹ️ <b>یادته چطور کار می‌کنه</b>\n\n🎂 <b>تولدها</b> — همه رو به ترتیب نزدیک‌ترین تولد\n➕ <b>افزودن شخص</b> — اسم، تولد شمسی، علایق و یادداشت\n⚙️ <b>تنظیمات</b> — خاموش/روشن کردن یادآوری‌ها، منطقه زمانی و حذف کامل اطلاعات\n\n<b>تاریخ‌ها</b> رو هرجوری راحتی بنویس؛ همه‌شون رو می‌فهمم:\n۱۸ مهر ۱۳۸۰ • ۲ آبان • 2001-10-10\n\n{{hint}}',
  },
  upcoming: {
    title: '🎂 <b>تولدها</b>',
    item: '{{index}}. <b>{{name}}</b>\n📅 {{date}} · ⏳ {{countdown}}',
    empty: '🎂 هنوز کسی ثبت نشده.\n\nاز دکمه «➕ افزودن شخص» شروع کن 🙂',
  },
  person: {
    title: '👤 <b>{{name}}</b>',
    birthday: '🎂 تولد: {{date}}',
    age: '🎂 تولد: {{date}} · {{age}} سال',
    countdown: '⏳ {{countdown}}',
    interests: '❤️ علایق',
    notes: '📝 یادداشت',
    reminders: '⏰ یادآوری‌ها: {{value}}',
  },
  addPerson: {
    /** Shows how far along the user is, so the flow never feels endless. */
    progress: '📋 مرحله {{current}} از {{total}}',
    askName:
      '👤 <b>اسمش چیه؟</b>\n\n💡 همون اسمی رو بنویس که خودت صداش می‌زنی.\n\n<i>مثلاً: مادر، رضا، دوست قدیمی پارسا</i>',
    askBirthday:
      '🎂 تولد <b>{{name}}</b> کیه؟\n\n📅 هرجوری راحتی بنویس، من می‌فهمم:\n\n<b>۱۸ مهر ۱۳۸۰</b>\n<b>۲ آبان</b>\n<b>2001-10-10</b>\n\n💡 اگه سالش رو نداری هم اشکالی نداره؛ سنش رو خودم حساب می‌کنم.',
    askInterests:
      '❤️ <b>{{name}}</b> چی دوست داره؟\n\n🎯 چند مورد رو با کاما جدا کن تا موقع تولد یادم بمونه:\n\n<i>مثلاً: گیم، فوتبال، قهوه</i>{{current}}',
    askNotes:
      '📝 یه نکته که دوست داشته باشی یادت بمونه؟\n\n💡 مثلاً: شیرینی دوست داره، اهل سفره{{current}}',
    /** Appended when «⏮ قبلی» re-opens a step that already has an answer. */
    currentAnswer: '\n\nالان: <b>{{value}}</b>',
    confirmation: '✅ <b>{{name}}</b> آماده‌ست. مطمئنی ذخیره بشه؟',
    invalidDate:
      '❌ این تاریخ رو نشناختم.\n\n📅 یه بار دیگه امتحان کن، مثلاً:\n\n<b>۱۸ مهر ۱۳۸۰</b> یا <b>۲ آبان</b>',
    invalidName:
      '❌ یه اسم معتبر بنویس 🙂\n\n💡 مثلاً: <b>مادر</b>، <b>رضا</b>، <b>دوست قدیمی پارسا</b>',
    saved: '🎉 <b>{{name}}</b> اضافه شد. از یادش نمی‌رم 🎂',
    /** Shown right after saving: what happens next. */
    savedFooter:
      '⏰ قبل از تولدش {{count}} بار یادت میارم. از زیر هم می‌تونی علایق، یادداشت و یادآوری‌هاش رو ببینی.',
  },
  edit: {
    choose: '✏️ کدوم رو می‌خوای عوض کنی؟',
    askName: '✏️ اسم جدیدش رو بفرست.\n\nالان: <b>{{current}}</b>',
    askBirthday: '✏️ تولد جدیدش رو بفرست.\n\nالان: <b>{{current}}</b>',
    askNotes: '📝 یادداشت جدید رو بفرست.\n\nبرای پاک کردنش «-» رو بفرست.',
    askInterests: '❤️ علایق جدید رو با کاما جدا کن و بفرست.\n\nبرای پاک کردن همه «-» رو بفرست.',
    updatedField: '✅ به‌روز شد.',
  },
  interests: {
    title: '❤️ علایق <b>{{name}}</b>',
    item: '• {{title}}',
    add: '➕ افزودن علاقه',
    empty: 'هنوز علاقه‌ای ثبت نشده.',
    askAdd: '❤️ علاقه جدید رو بنویس. چند مورد هم می‌تونی با کاما جدا کنی.',
    added: '✅ «{{title}}» اضافه شد.',
    removed: '🗑 «{{title}}» حذف شد.',
  },
  reminders: {
    title: '⏰ یادآوری تولد <b>{{name}}</b>',
    on: '☑️',
    off: '⬜️',
    item: '{{mark}} {{label}}',
    day0: 'روز تولد',
    daysBefore: '{{count}} روز قبل',
  },
  delete: {
    confirm: '🗑 <b>{{name}}</b> رو حذف کنم؟\n\nدیگه برنمی‌گردتش.',
    confirmYes: 'آره، حذف کن',
    confirmNo: 'نه، بی‌خیال',
    done: '🗑 <b>{{name}}</b> حذف شد.',
  },
  settings: {
    title: '⚙️ <b>تنظیمات</b>',
    remindersOn: '🔔 یادآوری‌ها: روشن',
    remindersOff: '🔕 یادآوری‌ها: خاموش',
    timezoneCurrent: '🌍 منطقه زمانی: <b>{{value}}</b>',
    languageCurrent: '🗣 زبان: <b>{{value}}</b>',
    saved: '✅ ذخیره شد.',
    savedTimezone: '✅ منطقه زمانی ذخیره شد: <b>{{value}}</b>',
    languageOnlyFa: '🗣 فعلاً فقط فارسی پشتیبانی می‌شه.',
    selectTimezone:
      '🌍 منطقه زمانی‌ات رو انتخاب کن:\n\nالان روی <b>{{value}}</b> تنظیم شده.\n«امروز» و «فردا» بر اساس همین حساب می‌شن.',
    dataButton: '🗑 حذف همه‌ی اطلاعات من',
    dataHint: 'می‌خوای بات هیچی ازت نگه نداره؟ دکمه‌ی پایین رو بزن.',
    dataTitle: '🗑 <b>حذف همه‌ی اطلاعات</b>',
    dataBody: [
      'این کار برگشت‌پذیر نیست. با تأیید، این‌ها برای همیشه پاک می‌شن:',
      '',
      '• همه‌ی افرادی که ثبت کردی، با اسم و تاریخ تولدشون',
      '• علایق، یادداشت‌ها و یادآوری‌های هرکدوم',
      '• تاریخچه‌ی یادآوری‌هایی که فرستادم',
      '• تنظیماتت: منطقه زمانی، زبان و روشن یا خاموش بودن یادآوری‌ها',
      '',
      'بعد از حذف، هر وقت برگردی بات از صفر شروع می‌کنه — انگار تازه اومدی 🙂',
    ].join('\n'),
    dataConfirmYes: 'بله، همه‌چیز رو پاک کن',
    dataConfirmNo: 'نه، بی‌خیال',
    dataErased: [
      '🧹 <b>همه‌ی اطلاعاتت پاک شد</b>',
      '',
      'افراد، تاریخ تولدها، علایق، یادداشت‌ها، یادآوری‌ها و تنظیماتت برای همیشه حذف شدند.',
      '',
      'از این به بعد هیچی ازت ذخیره نمی‌شه. هر وقت خواستی از نو شروع کنیم، /start رو بزن 🙂',
    ].join('\n'),
  },
  notification: {
    upcoming: '🎂 تولد <b>{{name}}</b> داره نزدیک می‌شه!',
    daysLeft: '⏳ {{count}} مونده.',
    date: '📅 {{date}}',
    age: '🎂 {{age}} سالش می‌شه',
    interests: '❤️ علایقش:\n{{list}}',
    footer: 'یه چیزی براش توی ذهنت جوشیدن؟ 😉',
    today: '🎉 امروز تولد <b>{{name}}</b> هست!',
    todayBody: 'اگه هنوز براش کاری نکردی، امروز بهترین فرصته. ❤️\n\n<i>هر سال یه سال دیگه باهاش!</i>',
  },
  countdown: {
    today: 'امروز',
    tomorrow: 'فردا',
    inDays: '{{count}} روز دیگه',
    /** Just the number and the unit, for sentences that supply their own verb. */
    daysCount: '{{count}} روز',
  },

  /** §3.1 — the home screen. */
  dashboard: {
    title: '🎂 <b>تولدهای نزدیک</b>',
    todayHeading: '🔴 امروز',
    weekHeading: '🟠 این هفته',
    laterHeading: '🟢 بعداً',
    emptyToday: 'امروز تولد کسی نیست 🙂',
    emptyWeek: 'این هفته هم تولدی نداریم.',
    emptyLater: 'تولد دیگه‌ای در پیش نیست.',
    /** No people at all: a different message, because the buckets are moot. */
    noneAtAll: 'هنوز کسی ثبت نکردی.\n\nاز «➕ افزودن شخص» شروع کن 🙂',
    item: '• <b>{{name}}</b> · 📅 {{date}}{{age}}',
    ageSuffix: ' · {{age}} سال',
    /** The three numbers the roadmap asks for above the buckets. */
    summary: '👥 {{people}} نفر ثبت شده · 🎂 {{monthCount}} تولد در {{monthName}}',
    nextUp: '⏳ نزدیک‌ترین تولد: <b>{{name}}</b> · {{countdown}}',
  },
  search: {
    title: '🔎 <b>جستجوی افراد</b>',
    prompt: 'اسم، علاقه‌مندی یا کلمه‌ای از یادداشت رو بنویس.\n\n💡 مثلاً: <b>فوتبال</b>، <b>مادر</b>، <b>قهوه</b>',
    resultsTitle: '🔎 نتیجه برای «<b>{{query}}</b>»',
    resultsCount: '{{count}} نفر پیدا شد.',
    item: '• <b>{{name}}</b> · 🎂 {{date}} · ⏳ {{countdown}}',
    empty: 'کسی با «{{query}}» پیدا نشد.\n\n💡 یه چیز دیگه امتحان کن، یا اگه مطمئنی این شخص رو ثبت نکردی، همین‌جا اضافه‌اش کن.',
    tooShort: '🔍 یه کم بیشتر بنویس — حداقل {{min}} حرف.',
    hint: '💡 جستجو توی اسم، علاقه‌مندی‌ها و یادداشت‌ها انجام می‌شه.',
  },
  calendar: {
    title: '📅 <b>تقویم تولدها</b>',
    monthHeading: '<b>{{monthName}} {{year}}</b>',
    /** One line per day that has a birthday. */
    day: '📆 {{day}} {{monthName}} — {{names}}',
    empty: 'این ماه تولدی ثبت نشده 🙂',
    otherMonths: '👀 بقیه‌ی ماه‌ها',
    prevMonth: '◀️ ماه قبل',
    nextMonth: 'ماه بعد ▶️',
    legend: '💡 فقط تولدهای همین ماه رو می‌بینی. برای بقیه از «🎂 تولدها» استفاده کن.',
    thisMonth: '📅 همین ماه',
  },
  snooze: {
    title: '⏰ یادآوری دوباره',
    prompt: 'کِی یادآوریت کنم؟',
    tomorrow: '⏰ فردا یادآوری کن',
    inDays: '{{count}} روز دیگه یادآوری کن',
    done: '⏰ باشه، یادت میارم — {{when}}.',
    expired: 'این یادآوری دیگه اعتبار نداره. تولد بعدی رو از «🎂 تولدها» ببین 🙂',
    alreadySnoozed: 'این یادآوری قبلاً تنظیم شده.',
  },
  health: {
    title: '🩺 <b>وضعیت بات</b>',
    ok: '✅ همه‌چیز سالمه.',
    database: '🗄 دیتابیس: {{value}}',
    reachable: 'متصل',
    unreachable: 'قطع — {{value}}',
    reminders: '⏰ یادآوری‌ها: {{value}}',
    schedulerUp: 'در حال اجرا',
    schedulerDown: 'متوقف',
    /** Shown when a probe fails; keeps the user out of the technical detail. */
    degraded: '⚠️ یه مشکلی هست. به‌زودی درستش می‌کنم.',
    /**
     * The database is unreachable, so no birthday can be stored or read. This is
     * deliberately distinct from `degraded`: promising a quick fix here would be
     * a lie, and the user may be about to miss a birthday.
     */
    down: '❌ بات الان نمی‌تونه کار کنه. لطفاً کمی بعد دوباره سر بزن.',
  },
} as const;

type NestedPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? `${K}` : `${K}.${NestedPaths<T[K]>}`;
}[keyof T & string];

/** Dot-path of every leaf string in the dictionary, e.g. `menu.upcoming`. */
export type TranslationKey = NestedPaths<typeof fa>;

export type Dictionary = typeof fa;
export type TranslationParams = Record<string, string | number>;
