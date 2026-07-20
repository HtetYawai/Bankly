export const formatTHB = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
}).format;

export const formatAdminDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format;

export function safeDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : formatAdminDate(parsed);
}

export function partyName(party, fallback = "System") {
  return party?.fullName ?? party?.accountNumber ?? fallback;
}
