/**
 * Minimal type declarations for `jalaali-js` (the package ships plain JS).
 * Only the conversion helpers Yadet actually uses are declared.
 */
declare module 'jalaali-js' {
  interface JalaaliDateObject {
    jy: number;
    jm: number;
    jd: number;
  }

  interface GregorianDateObject {
    gy: number;
    gm: number;
    gd: number;
  }

  const jalaali: {
    toJalaali(gy: number, gm: number, gd: number): JalaaliDateObject;
    toGregorian(jy: number, jm: number, jd: number): GregorianDateObject;
    isValidJalaaliDate(jy: number, jm: number, jd: number): boolean;
    isLeapJalaaliYear(jy: number): boolean;
    jalaaliMonthLength(jy: number, jm: number): number;
  };

  export default jalaali;
}
