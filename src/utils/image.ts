export function getDisplayImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("/")) {
    return trimmed;
  }

  // Convert Google Drive share/view links to direct thumbnail image streams
  // Matches URLs like:
  // - https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID
  const driveMatch = trimmed.match(/(?:file\/d\/|id=)([\w-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  }

  return trimmed;
}
