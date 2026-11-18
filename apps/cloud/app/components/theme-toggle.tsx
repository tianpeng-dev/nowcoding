'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(currentTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }

  return (
    <button aria-label="Toggle theme" className="btn-icon" onClick={toggleTheme} type="button">
      <svg aria-hidden="true" className="ico sm" viewBox="0 0 24 24">
        {theme === 'light' ? (
          <path d="M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
          </>
        )}
      </svg>
    </button>
  );
}
