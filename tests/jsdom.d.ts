// jsdom'un yalnızca testte kullanılan kısmı (ek @types bağımlılığı yerine)
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: { runScripts?: 'dangerously' | 'outside-only'; url?: string });
    readonly window: Window & typeof globalThis;
  }
}
