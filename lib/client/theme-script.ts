/** Shared between the server layout (inline script) and the client theme hook. No "use client" here on purpose. */
export const THEME_STORAGE_KEY = "bluechat-theme";

/** Inline script (runs before paint) that applies the persisted theme to <html> – avoids a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');}catch(e){}})();`;
