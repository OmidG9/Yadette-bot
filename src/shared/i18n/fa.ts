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
  },
  /** Shown in the Telegram command menu, so they stay short. */
  commands: {
    start: 'شروع / خوش‌آمد',
    help: 'راهنما',
    cancel: 'لغو کار نیمه‌کاره',
  },
  /** The single hint that tells a user how to leave any step. */
  hint: {
    cancel: 'هر وقت خواستی این مرحله رو ول کنی، «❌ لغو» رو بفرست.',
    skip: 'اگه چیزی نداری، «-» رو بفرست.',
    keyboard: 'می‌تونی از دکمه‌های زیر هم استفاده کنی.',
  },
  errors: {
    generic: '❌ یه مشکلی پیش اومد. دوباره تلاش کن.',
    notFound: '🔍 پیدا نشد.',
    forbidden: '🚫 به این مورد دسترسی نداری.',
    invalidInput: '❌ این درست نیست. یه بار دیگه بفرست.',
  },
  flow: {
    busy: 'این مرحله هنوز بازه 🙂 برای رفتن به منوی اصلی «/cancel» رو بفرست.',
    notActive: 'این مرحله تموم شده. دوباره از منو شروع کن 🙂',
    cancelled: '❌ لغو شد. هر وقت خواستی از منو ادامه بده.',
  },
  menu: {
    title: '🎂 یادت',
    upcoming: '🎂 تولدها',
    addPerson: '➕ افزودن شخص',
    settings: '⚙️ تنظیمات',
    home: '🏠 منوی اصلی',
    help: 'ℹ️ راهنما',
  },
  start: {
    /** First contact: what it does, what it stores, one obvious next step. */
    newUser:
      '🎂 <b>سلام! من یادم.</b>\n\nکارم ساده‌ست: تولد آدم‌های مهم زندگیت رو نگه می‌دارم و به‌موقع یادت میارم — ۷ روز قبل، ۳ روز قبل، ۱ روز قبل و روز خود تولد.\n\n<b>چی ثبت می‌کنی؟</b>\n• اسم و تولد (شمسی)\n• علایق و یادداشتی که کمکت می‌کنه یادت بمونه\n\n🔒 همه‌چیز توی دیتابیس خودمه و فقط تو می‌بینیش.',
    /** Returning user with at least one person. */
    returning: '🎂 خوش اومدی <b>{{name}}</b>!',
    /** Returning user who never finished adding someone. */
    empty: '🎂 خوش اومدی <b>{{name}}</b>!\n\nهنوز کسی اضافه نکردی. اولین نفر رو بذار توی یادت 👇',
    cta: '➕ اضافه کردن اولین نفر',
    /** Sent when the CTA deep link cannot be built. */
    ctaFallback: 'روی «➕ افزودن شخص» توی منو بزن تا شروع کنیم 🙂',
  },
  help: {
    text: 'ℹ️ <b>یادت چطور کار می‌کنه</b>\n\n🎂 <b>تولدها</b> — همه رو به ترتیب نزدیک‌ترین تولد\n➕ <b>افزودن شخص</b> — اسم، تولد شمسی، علایق و یادداشت\n⚙️ <b>تنظیمات</b> — خاموش/روشن کردن یادآوری‌ها و منطقه زمانی\n\n<b>تاریخ‌ها</b> رو هرجوری راحتی بنویس؛ همه‌شون رو می‌فهمم:\n۱۸ مهر ۱۳۸۰ • ۲ آبان • 2001-10-10\n\n{{hint}}',
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
    askName: '👤 اسمش چیه؟',
    askBirthday:
      '🎂 تولد <b>{{name}}</b> کیه؟\n\nهرجوری راحتی بنویس؛ مثلاً:\n\n۱۸ مهر ۱۳۸۰\n۲ آبان\n2001-10-10',
    askInterests: '❤️ <b>{{name}}</b> چی دوست داره؟\n\nچند مورد رو با کاما جدا کن، مثلاً:\n\nگیم، فوتبال، قهوه',
    askNotes: '📝 یه نکته که دوست داشته باشی یادت بمونه؟\n\n(مثلاً: شیرینی دوست داره، اهل سفره)',
    confirmation: '✅ اینم <b>{{name}}</b> — مطمئنی ذخیره بشه؟',
    invalidDate: '❌ این تاریخ رو نشناختم.\n\nمثلاً بنویس: <b>۱۸ مهر ۱۳۸۰</b> یا <b>۲ آبان</b>',
    invalidName: '❌ اسمش چیه؟ یه اسم معتبر بنویس 🙂',
    saved: '🎉 <b>{{name}}</b> اضافه شد. از یادش نمی‌رم 🎂',
    /** Shown right after saving: what happens next. */
    savedFooter:
      'قبل از تولدش {{count}} بار یادت میارم. از زیر هم می‌تونی علایق، یادداشت و یادآوری‌هاش رو ببینی.',
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
    selectTimezone: '🌍 منطقه زمانی‌ات رو انتخاب کن:\n\n«امروز» بر اساس همین محاسبه می‌شه.',
    languageOnlyFa: '🗣 فعلاً فقط فارسی پشتیبانی می‌شه.',
  },
  notification: {
    upcoming: '🎂 تولد <b>{{name}}</b> داره نزدیک می‌شه!',
    daysLeft: '⏳ {{count}} مونده.',
    date: '📅 {{date}}',
    age: '🎂 {{age}} سالش می‌شه',
    interests: '❤️ علایقش:\n{{list}}',
    footer: 'یه چیزی براش توی ذهنت جوشیدن؟ 😉',
    today: '🎉 امروز تولد <b>{{name}}</b> هست!',
    todayBody:
      '🎂 تولدت مبارک {{name}}! ❤️\n\nاگه هنوز براش کاری نکردی، امروز بهترین فرصته.',
  },
} as const;

type NestedPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? `${K}` : `${K}.${NestedPaths<T[K]>}`;
}[keyof T & string];

/** Dot-path of every leaf string in the dictionary, e.g. `menu.upcoming`. */
export type TranslationKey = NestedPaths<typeof fa>;

export type Dictionary = typeof fa;
export type TranslationParams = Record<string, string | number>;
