'use client';

import { useEffect } from 'react';
import { generateDynamicFavicon } from '../utils/favicon';

export default function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('vybe-theme') || 'rose';
    
    // Remove other theme classes
    document.documentElement.classList.remove('theme-rose', 'theme-violet', 'theme-cyan', 'theme-emerald');
    document.documentElement.classList.add(`theme-${savedTheme}`);
    
    // Generate canvas favicon
    generateDynamicFavicon(savedTheme);
  }, []);

  return null;
}
