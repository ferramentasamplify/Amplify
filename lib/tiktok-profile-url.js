export function cleanTikTokHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .split("?")[0]
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "")
    .split(/[/?#]/)[0]
    .trim();
}

export function tiktokProfileUrl(handle) {
  const clean = cleanTikTokHandle(handle);
  return clean ? `https://www.tiktok.com/@${encodeURIComponent(clean)}` : "";
}
