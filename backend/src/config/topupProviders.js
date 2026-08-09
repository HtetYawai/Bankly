// Canonical list of provider top-ups (self-debit only, no Bankly receiver).
// PromptPay is intentionally excluded: it credits a real Bankly account and
// goes through the transfer flow instead, so it never hits this endpoint.
export const TOPUP_PROVIDERS = [
  { name: "TrueMove H", type: "Mobile" },
  { name: "AIS", type: "Mobile" },
  { name: "DTAC", type: "Mobile" },
  { name: "LINE Pay", type: "E-Wallet" },
  { name: "Rabbit", type: "Transit" },
  { name: "GrabPay", type: "E-Wallet" },
  { name: "ShopeePay", type: "E-Wallet" },
  { name: "Lazada", type: "E-Wallet" },
];
