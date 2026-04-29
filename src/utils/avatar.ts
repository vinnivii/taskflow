const COLORS = ["#F2C94C", "#A855F7", "#3B82F6", "#22C55E", "#EF4444", "#F97316"];

export function generateAvatar(name: string): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const index = name.charCodeAt(0) % COLORS.length;
  const color = COLORS[index];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}" opacity="0.9"/><text x="32" y="38" text-anchor="middle" fill="#0A0A0A" font-family="Inter,sans-serif" font-weight="700" font-size="22">${initials}</text></svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
