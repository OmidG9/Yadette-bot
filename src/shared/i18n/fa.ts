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
  /**
   * Quick picks: one tap instead of typing. Offered as inline buttons, so a
   * step that has a common answer can be finished without the keyboard at all.
   * Index-addressed, never sent through a callback payload.
   */
  presets: {
    name: [
      'مادر',
      'پدر',
      'همسر',
      'خواهر',
      'برادر',
      'دوست',
      'همکار',
      'رفیق',
      'معلم',
      'همسایه',
      'عمه',
      'خاله',
    ],
    interest: [
      'فوتبال',
      'گیم',
      'موسیقی',
      'فیلم',
      'کتاب',
      'قهوه',
      'شیرینی',
      'سفر',
      'ورزش',
      'تکنولوژی',
      'نقاشی',
      'طبیعت',
    ],
  },
  addPerson: {
    /** Shows how far along the user is, so the flow never feels endless. */
    progress: '📋 مرحله {{current}} از {{total}} · {{bar}}',
    askName:
      '👤 <b>اسمش چیه؟</b>\n\n💡 یکی از دکمه‌های پایین رو بزن، یا خودت بنویس.\n\n<i>مثلاً: مادر، رضا، دوست قدیمی پارسا</i>',
    askInterests:
      '❤️ <b>{{name}}</b> چی دوست داره؟\n\n💡 دکمه‌های پایین رو بزن تا انتخاب شه، یا خودت بنویس:\n\n<i>مثلاً: گیم، فوتبال، قهوه</i>{{current}}',
    askNotes:
      '📝 یه نکته که دوست داشته باشی یادت بمونه؟\n\n💡 مثلاً: شیرینی دوست داره، اهل سفره{{current}}',
    /** Appended when «⏮ قبلی» re-opens a step that already has an answer. */
    currentAnswer: '\n\nالان: <b>{{value}}</b>',
    /** Shown above the chip row of the name step. */
    chipsTitle: '👇 یکی رو بزن یا خودت بنویس:',
    /** Shown above the chip row of the interests step. */
    interestsChipsTitle: '👇 هرچی دوست داره انتخاب کن (می‌تونی چندتا بزنی):',
    /** Footer of the interests step once at least one chip is on. */
    interestsDone: '✅ همین‌ها کافیه',
    confirmation: '✅ <b>{{name}}</b> آماده‌ست. مطمئنی ذخیره بشه؟',
    invalidDate: '❌ این تاریخ رو نشناختم. یا از دکمه‌ها انتخاب کن، یا دوباره بنویس.',
    invalidName: '❌ یه اسم معتبر بنویس 🙂 یا یکی از دکمه‌های پایین رو بزن.',
    saved: '🎉 <b>{{name}}</b> اضافه شد. از یادش نمی‌رم 🎂',
    /** Shown right after saving: what happens next. */
    savedFooter:
      '⏰ قبل از تولدش {{count}} بار یادت میارم. از زیر هم می‌تونی علایق، یادداشت و یادآوری‌هاش رو ببینی.',
  },
  /**
   * §35 — the Jalali date picker of the add-person flow.
   *
   * Three screens (month → day → year) instead of one free-text answer. Typing
   * a date still works on every screen: the step handler is unchanged.
   */
  picker: {
    title: '🎂 تولد <b>{{name}}</b> کیه؟',
    askMonth: '۱️⃣ ماه تولدش رو انتخاب کن:',
    askDay: '۲️⃣ چندمه؟ · ماه <b>{{month}}</b>',
    askYear: '۳️⃣ سالش رو انتخاب کن (اختیاری)',
    /** Progress of the picker itself, under the title. */
    subtitle: '{{done}} از ۳ مرحله انتخاب شد',
    /** "month and day picked, now the year" — shown above the year grid. */
    chosenSoFar: '✅ <b>{{date}}</b> انتخاب شد.',
    noYear: '🤷 سال رو نمی‌دونم',
    backScreen: '↩️ یه قدم عقب',
    editName: '✏️ اسم رو عوض کن',
    prevPage: '◀️ قبلی',
    nextPage: 'بعدی ▶️',
    /** After the year on each button of the year grid: «۲۵ سال». */
    ageUnit: 'سال',
    /** The day does not exist in the month chosen a screen earlier. */
    invalidDay: '⚠️ این ماه این تعداد روز نداره؛ یه روز دیگه بزن.',
    /** Always the last line: the escape hatch that needs no buttons. */
    typeHint: '✍️ یا خودت بنویس: <b>۱۸ مهر ۱۳۸۰</b> · <b>۲ آبان</b>',
    /** The year on screen does not exist for the chosen Esfand 30. */
    yearMismatch: '⚠️ اسفند ۳۰ فقط توی سال‌های کبیسه وجود داره؛ یه سال دیگه بزن.',
    footerCancel: '❌ لغو',
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
    /**
     * Toggle marks. A green check reads as "on" at a glance on every client,
     * which the old ☑️/⬜️ pair did not.
     */
    on: '✅',
    off: '⬜️',
    item: '{{mark}} {{label}}',
    day0: 'روز تولد',
    daysBefore: '{{count}} روز قبل',
    /** Button-sized variant: the question above it already says "how many days". */
    daysShort: '{{count}} روز',
    /** Header of the reminder grid on the confirmation screen. */
    askWhen: '⏰ کِی یادت بیارم؟',
    /** How many offsets are currently on. */
    selectionCount: '{{count}} یادآوری روشنه',
    resetDefaults: '🔄 پیش‌فرض',
    save: '✅ ذخیره و ثبت',
    legend: '<i>✅ یعنی یادت میارم · ⬜️ یعنی نه</i>',
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
    todayBody:
      'اگه هنوز براش کاری نکردی، امروز بهترین فرصته. ❤️\n\n<i>هر سال یه سال دیگه باهاش!</i>',
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
    prompt:
      'اسم، علاقه‌مندی یا کلمه‌ای از یادداشت رو بنویس.\n\n💡 مثلاً: <b>فوتبال</b>، <b>مادر</b>، <b>قهوه</b>',
    resultsTitle: '🔎 نتیجه برای «<b>{{query}}</b>»',
    resultsCount: '{{count}} نفر پیدا شد.',
    item: '• <b>{{name}}</b> · 🎂 {{date}} · ⏳ {{countdown}}',
    empty:
      'کسی با «{{query}}» پیدا نشد.\n\n💡 یه چیز دیگه امتحان کن، یا اگه مطمئنی این شخص رو ثبت نکردی، همین‌جا اضافه‌اش کن.',
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
  chat: {
    thinking: '<b>������ �.�O�?O���^��...</b>',
    typing: '<b>������ �.�O�?O���^��...</b>',
    generating: '<b>������ ���^�O ���^�"��...</b>',
    streaming: '<b>���.�� ���^�O ���^�"��...</b>',
    sending: '������ ��������O��...',
    sent: '�����O���� ���.',
    failed: '�?O ��������O�� �.����"�O ���O�� ���^�.��.',
    retry: '�o-���� ��������O��',
    retrying: '������ �����������...',
    autoScroll: '���.�����O�� ���������O',
    copy: '�����O�O��',
    copied: '�����O���� ���.',
  },  feedback: {
    saved: '<b>ذخیره شد.</b>',
    updated: '<b>به‌روزرسانی شد.</b>',
    deleted: '<b>حذف شد.</b>',
    copied: '<b>کپی شد.</b>',
    done: '<b>انجام شد.</b>',
    success: '<b>موفقیت‌آمیز بود.</b>',
    failed: 'خطایی رخ داد.',
    pleaseWait: 'لطفاً صبر کنید...',
    working: 'در حال انجام کار...',
    retry: 'تلاش مجدد',
    tryAgain: 'دوباره تلاش کنید',
  },  health: {
    title: '🩺 <b>وضعیت بات</b>',
    ok: '✅ همه‌چیز درست کار می‌کنه.',
    database: '🗄 پایگاه داده: {{value}}',
    reachable: '✅ در دسترس',
    unreachable: '❌ در دسترس نیست: {{value}}',
    reminders: '⏰ یادآورها: {{value}}',
    schedulerUp: '✅ زمان‌بندی فعاله',
    schedulerDown: '❌ زمان‌بندی فعال نیست',
    /** Shown when a probe fails; keeps the user out of the technical detail. */
    degraded: '⚠️ بخشی از بات موقتاً درست کار نمی‌کنه. لطفاً کمی بعد دوباره امتحان کن.',
    /**
     * The database is unreachable, so no birthday can be stored or read. This is
     * deliberately distinct from `degraded`: promising a quick fix here would be
     * a lie, and the user may be about to miss a birthday.
     */
    down: '❌ پایگاه داده در دسترس نیست؛ فعلاً نمی‌تونم تولدها رو ذخیره یا نمایش بدم. کمی بعد دوباره امتحان کن.',
  },
  states: {
    loading: {
      title: '⏳ <b>در حال بارگذاری...</b>',
      subtitle: 'لطفاً چند لحظه صبر کن.',
    },
    empty: {
      title: '📭 <b>موردی پیدا نشد.</b>',
      subtitle: 'با گزینه‌های دیگه دوباره امتحان کن.',
      cta: '➕ افزودن شخص',
    },
    error: {
      title: '⚠️ <b>بارگذاری انجام نشد.</b>',
      subtitle: 'یه مشکلی پیش اومد. دوباره تلاش کن.',
      retry: '🔄 تلاش دوباره',
    },
  },
} as const;

/**
 * Leaf strings of the dictionary, addressed by dot-path (`menu.upcoming`).
 *
 * String lists are excluded on purpose: they carry no placeholders and are read
 * with `tl`, so letting `t` reach them would only produce the key itself.
 */
type NestedPaths<T> = {
  [K in keyof T & string]: T[K] extends readonly string[]
    ? never
    : T[K] extends string
      ? K
      : `${K}.${NestedPaths<T[K]>}`;
}[keyof T & string];

/**
 * Dot-path of every string list in the dictionary, e.g. `presets.name`.
 *
 * Recursive because the lists are not at the root: `presets.name` is a list one
 * level down, and a one-level version of this would type it as `never` and reject
 * every `tl()` call.
 */
type ListPaths<T> = {
  [K in keyof T & string]: T[K] extends readonly string[]
    ? K
    : T[K] extends object
      ? `${K}.${ListPaths<T[K]>}`
      : never;
}[keyof T & string];

/** Dot-path of every leaf string in the dictionary, e.g. `menu.upcoming`. */
export type TranslationKey = NestedPaths<typeof fa>;

/** Dot-path of every list in the dictionary, e.g. `presets.name`. */
export type ListKey = ListPaths<typeof fa>;

export type Dictionary = typeof fa;
export type TranslationParams = Record<string, string | number>;
