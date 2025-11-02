// src/lib/debug.ts
/* super-light debug helpers */

export const GG = {
    on: (() => {
      const q = new URLSearchParams(location.search).get("debug");
      const ls = typeof localStorage !== "undefined" ? localStorage.getItem("gg_debug") : null;
      return q === "1" || ls === "1";
    })(),
  };
  
  export function d(...args: any[]) {
    if (GG.on) {
      // eslint-disable-next-line no-console
      console.log("%c[GG]", "color:#ffe28a;font-weight:700", ...args);
    }
  }
  
  export function warn(...args: any[]) {
    // eslint-disable-next-line no-console
    console.warn("%c[GG]", "color:#ff9f43;font-weight:700", ...args);
  }
  
  export function err(...args: any[]) {
    // eslint-disable-next-line no-console
    console.error("%c[GG]", "color:#ff6b6b;font-weight:700", ...args);
  }
  
  export function expose(key: string, val: any) {
    // @ts-ignore
    (window as any)[key] = val;
    d("exposed on window as", key, val);
  }