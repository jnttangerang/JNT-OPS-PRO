// Favicon management utility for J&T OPS PRO

export interface FaviconPreset {
  id: string;
  name: string;
  category: string;
  previewUrl: string;
  url: string;
  description: string;
}

// Default J&T Red Express Icon (High-DPI SVG Data URL)
export const DEFAULT_FAVICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23E4002B'/%3E%3Cpath d='M12 36h6v4h-6zM14 26h22v14H14z' fill='%23ffffff'/%3E%3Cpath d='M36 29h9l5 6v5h-14v-11z' fill='%23ffffff'/%3E%3Ccircle cx='22' cy='42' r='4' fill='%23ffffff'/%3E%3Ccircle cx='43' cy='42' r='4' fill='%23ffffff'/%3E%3Cpath d='M14 20h14v4H14z' fill='%23ffffff' opacity='0.85'/%3E%3C/svg%3E`;

// Favicon Presets
export const FAVICON_PRESETS: FaviconPreset[] = [
  {
    id: "jnt-red",
    name: "J&T Red Express",
    category: "Resmi",
    description: "Ikon merah khas J&T dengan simbol armada pengiriman express",
    previewUrl: DEFAULT_FAVICON_SVG,
    url: DEFAULT_FAVICON_SVG,
  },
  {
    id: "jnt-badge",
    name: "J&T Bold Monogram",
    category: "Brand",
    description: "Badge bulat merah dengan tipografi J&T OPS",
    previewUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23E4002B' stroke='%23ffffff' stroke-width='2'/%3E%3Ctext x='32' y='38' font-family='Arial, sans-serif' font-weight='900' font-size='22' fill='%23ffffff' text-anchor='middle'%3EJ%26T%3C/text%3E%3Ctext x='32' y='50' font-family='Arial, sans-serif' font-weight='700' font-size='9' fill='%23FFE5E8' text-anchor='middle' letter-spacing='1'%3EOPS PRO%3C/text%3E%3C/svg%3E`,
    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23E4002B' stroke='%23ffffff' stroke-width='2'/%3E%3Ctext x='32' y='38' font-family='Arial, sans-serif' font-weight='900' font-size='22' fill='%23ffffff' text-anchor='middle'%3EJ%26T%3C/text%3E%3Ctext x='32' y='50' font-family='Arial, sans-serif' font-weight='700' font-size='9' fill='%23FFE5E8' text-anchor='middle' letter-spacing='1'%3EOPS PRO%3C/text%3E%3C/svg%3E`,
  },
  {
    id: "speed-orange",
    name: "Speed Logistics",
    category: "Modern",
    description: "Gradasi oranye dinamis dengan simbol kilat pengiriman cepat",
    previewUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23FF6B00'/%3E%3Cpath d='M34 14L18 36h14l-4 16 18-24H32l6-14z' fill='%23ffffff'/%3E%3C/svg%3E`,
    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23FF6B00'/%3E%3Cpath d='M34 14L18 36h14l-4 16 18-24H32l6-14z' fill='%23ffffff'/%3E%3C/svg%3E`,
  },
  {
    id: "cargo-blue",
    name: "Cargo Heavy Duty",
    category: "Cargo",
    description: "Badge biru navy untuk divisi pengiriman Cargo & Ekspedisi",
    previewUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231E40AF'/%3E%3Cpath d='M16 22h32v20H16z' fill='none' stroke='%23ffffff' stroke-width='4' stroke-linejoin='round'/%3E%3Cpath d='M24 22v20M32 22v20M40 22v20M16 32h32' stroke='%23ffffff' stroke-width='2.5'/%3E%3C/svg%3E`,
    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231E40AF'/%3E%3Cpath d='M16 22h32v20H16z' fill='none' stroke='%23ffffff' stroke-width='4' stroke-linejoin='round'/%3E%3Cpath d='M24 22v20M32 22v20M40 22v20M16 32h32' stroke='%23ffffff' stroke-width='2.5'/%3E%3C/svg%3E`,
  },
  {
    id: "shield-dark",
    name: "Secure Operations",
    category: "Keamanan",
    description: "Badge gelap premium dengan perisai keamanan operasional",
    previewUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23171717'/%3E%3Cpath d='M32 14l16 6v14c0 10-7 18-16 20-9-2-16-10-16-20V20l16-6z' fill='%23E4002B'/%3E%3Cpath d='M26 33l5 5 10-10' fill='none' stroke='%23ffffff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`,
    url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23171717'/%3E%3Cpath d='M32 14l16 6v14c0 10-7 18-16 20-9-2-16-10-16-20V20l16-6z' fill='%23E4002B'/%3E%3Cpath d='M26 33l5 5 10-10' fill='none' stroke='%23ffffff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`,
  },
];

const FAVICON_STORAGE_KEY = "jnt_custom_favicon";

// Get currently configured favicon URL
export function getAppFavicon(): string {
  if (typeof window === "undefined") return DEFAULT_FAVICON_SVG;
  try {
    const saved = localStorage.getItem(FAVICON_STORAGE_KEY);
    if (saved && saved.trim() !== "") return saved;
  } catch (e) {
    console.error("Error reading custom favicon:", e);
  }
  return DEFAULT_FAVICON_SVG;
}

// Dynamically set / update document favicon in the browser DOM
export function setAppFavicon(faviconUrl: string): void {
  if (typeof document === "undefined") return;
  try {
    const finalUrl = faviconUrl && faviconUrl.trim() !== "" ? faviconUrl : DEFAULT_FAVICON_SVG;
    
    // Save to localStorage for instant load next time
    localStorage.setItem(FAVICON_STORAGE_KEY, finalUrl);

    // Update or create <link rel="icon">
    let linkIcon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!linkIcon) {
      linkIcon = document.createElement("link");
      linkIcon.rel = "icon";
      document.head.appendChild(linkIcon);
    }
    linkIcon.href = finalUrl;

    // Update or create <link rel="apple-touch-icon">
    let linkApple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!linkApple) {
      linkApple = document.createElement("link");
      linkApple.rel = "apple-touch-icon";
      document.head.appendChild(linkApple);
    }
    linkApple.href = finalUrl;
  } catch (e) {
    console.error("Error setting favicon:", e);
  }
}

// Reset favicon back to default
export function resetAppFavicon(): void {
  setAppFavicon(DEFAULT_FAVICON_SVG);
}

// Initialize favicon on application boot
export function initFavicon(): void {
  if (typeof window === "undefined") return;
  const current = getAppFavicon();
  setAppFavicon(current);
}
