declare const __BUILD_TIME__: string | undefined;
/** Derleme zamanı (vite define). Testlerde tanımsızdır. */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
