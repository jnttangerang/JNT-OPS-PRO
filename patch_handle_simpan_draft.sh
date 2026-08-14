sed -i '/\/\/ Auto-Save Effect (Debounced 800ms)/,/      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);/d' src/components/PreInputPage.tsx
sed -i '/    };/d' src/components/PreInputPage.tsx
