/**
 * Persian strings (the only locale in the MVP).
 *
 * This is the single place for user-facing copy; business logic contains no
 * hard-coded text. Adding `en.ts` later means adding a locale file plus one
 * entry in `index.ts` — no logic changes.
 *
 * `{{name}}` placeholders are replaced by `t(key, lang, params)`.
 */
export const fa = {
  common: {
    cancel: '❌ لغو',
    back: '🔙 بازگشت',
    skip: 'رد کردن',
    confirm: '✅ تایید',
    yes: '✅ بله',
    no: '❌ خیر',
    unknown: '—',
    loading: '⏳ یه لحظه…',
    dash: '—',
  },
  buttons: {
    editName: '✏️ اسم',
    editBirthday: '🎂 تاریخ تولد',
    editInterests: '❤️ علایق',
    editNotes: '📝 یادداشت',
    editReminders: '⏰ یادآوری',
    delete: '🗑 حذف',
    back: '🔙 بازگشت',
    confirm: '✅ تایید',
    cancel: '❌ لغو',
    skip: 'رد کردن',
    close: 'بستن',
    home: '🏠 منوی اصلی',
    addInterest: '➕ افزودن علاقه',
    addPerson: '➕ افزودن شخص',
    people: '👥 افراد من',
    upcoming: '🎂 تولدها',
    settings: '⚙️ تنظیمات',
    today: '🎂 تولدهای امروز',
  },
  errors: {
    generic: '❌ یه مشکلی پیش اومد.\n\nلطفاً دوباره تلاش کن.',
    notFound: '🔍 پیدا نشد.',
    forbidden: '🚫 به این مورد دسترسی نداری.',
    invalidInput: '❌ ورودی نامعتبره.',
  },
  flow: {
    busy: 'برای خروج از این مرحله «❌ لغو» رو بفرست 🙂',
    hint: 'برای رد کردن این مرحله، «-» رو بفرست.',
    finish: '✅ تموم شد.',
    notActive: 'این مرحله تموم شده. دوباره از منو شروع کن 🙂',
  },
  menu: {
    title: '🎂 یادت',
    upcoming: '🎂 تولدها',
    people: '👥 افراد من',
    addPerson: '➕ افزودن شخص',
    settings: '⚙️ تنظیمات',
    home: '🏠 منوی اصلی',
    help: 'ℹ️ راهنما',
  },
  start: {
    newUser:
      '🎂 <b>به یادت خوش اومدی!</b>\n\nیادت کمک می‌کنه تولد آدم‌های مهم زندگیت رو فراموش نکنی.\n\nاز همین الان می‌تونی اولین نفر رو اضافه کنی.',
    returning: '🎂 خوش اومدی <b>{{name}}</b>!\n\nبیا ببینیم چه تولدهایی نزدیکه.',
  },
  help: {
    text: 'ℹ️ <b>راهنمای یادت</b>\n\n• <b>➕ افزودن شخص</b> — اسم، تولد، علایق و یادداشت رو ثبت کن\n• <b>👥 افراد من</b> — لیست آدم‌ها به ترتیب تولد بعدی\n• <b>🎂 تولدها</b> — تولدهای پیش‌رو\n• <b>⚙️ تنظیمات</b> — یادآوری‌ها، منطقه زمانی و زبان\n\nهر جا لازم بود می‌تونی با «❌ لغو» از هر مرحله‌ای خارج بشی.',
  },
  empty: {
    noPeople: '👥 هنوز کسی رو اضافه نکردی.\n\nبا دکمه «➕ افزودن شخص» شروع کن.',
    noUpcoming: '🎂 فعلاً تولد پیش‌رویی ثبت نشده.',
    noInterests: 'علاقه‌ای ثبت نشده',
    noNotes: 'یادداشتی ثبت نشده',
  },
  upcoming: {
    title: '🎂 <b>تولدهای پیش‌رو</b>',
    item: '{{index}}. <b>{{name}}</b>\n📅 {{date}}\n⏳ {{countdown}}',
    empty: '🎂 فعلاً تولد پیش‌رویی ثبت نشده.',
    more: '… و {{count}} نفر دیگه',
  },
  people: {
    title: '👥 <b>افراد من</b>',
    item: '{{index}}. {{name}} — 📅 {{date}} · ⏳ {{countdown}}',
    empty: '👥 هنوز کسی رو اضافه نکردی.\n\nبا دکمه «➕ افزودن شخص» شروع کن.',
  },
  person: {
    title: '👤 <b>{{name}}</b>',
    birthday: '🎂 تولد: {{date}}',
    age: '🎂 تولد: {{date}} ({{age}} سال)',
    countdown: '⏳ {{countdown}}',
    interests: '❤️ علایق:',
    notes: '📝 یادداشت:',
    reminders: '⏰ یادآوری‌ها: {{value}}',
  },
  addPerson: {
    start: '➕ افزودن شخص\n\nاول از همه اسمش رو بگو.',
    askName: '👤 اسمش چیه؟',
    askBirthday: '🎂 تاریخ تولد <b>{{name}}</b> رو وارد کن.\n\nمثال:\n۱۸ مهر ۱۳۸۰\n\nیا:\n2001-10-10',
    askInterests:
      '❤️ چه چیزهایی دوست داره؟\n\nمی‌تونی چند مورد بنویسی، مثلاً:\n\nگیم، فوتبال، قهوه، ماشین',
    askNotes: '📝 نکته‌ای درباره <b>{{name}}</b> هست که دوست داری یادت بمونه؟',
    confirmation: '✅ <b>{{name}}</b> آماده‌ست. مطمئنی ذخیره بشه؟',
    invalidDate: '❌ تاریخ وارد شده معتبر نیست.\n\nمثلاً:\n۱۸ مهر ۱۳۸۰',
    invalidName: '❌ اسم معتبر نیست. لطفاً دوباره بفرست.',
    saved: '🎉 <b>{{name}}</b> اضافه شد.',
    cancelled: '❌ لغو شد.',
  },
  edit: {
    choose: '✏️ چی رو می‌خوای تغییر بدی؟',
    name: '✏️ اسم',
    birthday: '🎂 تاریخ تولد',
    interests: '❤️ علایق',
    notes: '📝 یادداشت',
    reminders: '⏰ یادآوری',
    askName: '✏️ اسم جدید رو بفرست.\n\nالان: <b>{{current}}</b>',
    askBirthday: '🎂 تاریخ تولد جدید رو بفرست.\n\nالان: <b>{{current}}</b>',
    askNotes: '📝 یادداشت جدید رو بفرست.\n\nبرای حذف یادداشت، «-» رو بفرست.',
    askInterests:
      '❤️ علایق جدید رو بفرست (با کاما جدا کن).\n\nبرای حذف همه، «-» رو بفرست.',
    updated: '✅ <b>{{name}}</b> آپدیت شد.',
    updatedField: '✅ آپدیت شد.',
  },
  interests: {
    title: '❤️ علایق <b>{{name}}</b>',
    item: '• {{title}}',
    add: '➕ افزودن علاقه',
    remove: '🗑 حذف',
    empty: 'هنوز علاقه‌ای ثبت نشده.',
    askAdd: '❤️ علاقه جدید رو بنویسی. چند مورد هم می‌تونی با کاما جدا کنی.',
    added: '✅ «{{title}}» اضافه شد.',
    removed: '🗑 «{{title}}» حذف شد.',
    limit: '❌ تعداد علایق بیشتر از حد مجازه.',
  },
  reminders: {
    title: '⏰ یادآوری تولد <b>{{name}}</b>',
    on: '☑️',
    off: '⬜️',
    item: '{{mark}} {{label}}',
    day0: 'روز تولد',
    daysBefore: '{{count}} روز قبل',
    updated: '✅ یادآوری‌ها آپدیت شد.',
  },
  delete: {
    confirm: '⚠️ مطمئنی می‌خوای «<b>{{name}}</b>» رو حذف کنی؟',
    confirmYes: '🗑 بله، حذف کن',
    confirmNo: '❌ لغو',
    done: '🗑 <b>{{name}}</b> حذف شد.',
  },
  settings: {
    title: '⚙️ <b>تنظیمات</b>',
    reminders: '🔔 یادآوری‌ها',
    timezone: '🌍 منطقه زمانی',
    language: '🗣 زبان',
    remindersOn: '🔔 یادآوری‌ها: روشن',
    remindersOff: '🔕 یادآوری‌ها: خاموش',
    timezoneCurrent: '🌍 منطقه زمانی: <b>{{value}}</b>',
    languageCurrent: '🗣 زبان: <b>{{value}}</b>',
    selectTimezone: '🌍 منطقه زمانی‌ات رو انتخاب کن:',
    timezoneUpdated: '✅ منطقه زمانی: <b>{{value}}</b>',
    languageOnlyFa: '🗣 فعلاً فقط فارسی پشتیبانی می‌شه.',
    updated: '✅ تنظیمات آپدیت شد.',
  },
  notification: {
    upcoming: '🎂 تولد <b>{{name}}</b> نزدیکه!',
    daysLeft: '⏳ فقط {{count}} مونده.',
    date: '📅 {{date}}',
    interests: '❤️ علایق:\n{{list}}',
    footer: 'یادت نره یه کاری براش بکنی 😉',
    today: '🎉 امروز تولد <b>{{name}}</b> هست!',
    todayBody: '🎂 تولدت مبارک {{name}}! ❤️\n\nاگه هنوز براش کاری نکردی، امروز بهترین فرصته.',
  },
} as const;

type NestedPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? `${K}` : `${K}.${NestedPaths<T[K]>}`;
}[keyof T & string];

/** Dot-path of every leaf string in the dictionary, e.g. `menu.people`. */
export type TranslationKey = NestedPaths<typeof fa>;

export type Dictionary = typeof fa;
export type TranslationParams = Record<string, string | number>;
