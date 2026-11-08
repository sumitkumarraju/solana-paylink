import { ImageResponse } from "next/og";

// The preview card shown when a PayLink URL is shared on X, Telegram, Discord and so on.
export const alt = "PayLink: get paid in USDC on Solana with a link";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>PayLink</div>
        <div style={{ marginTop: 24, fontSize: 44, color: "#a1a1aa" }}>
          Get paid in USDC on Solana with a link.
        </div>
        <div style={{ marginTop: 56, display: "flex", gap: 24, fontSize: 30, color: "#d4d4d8" }}>
          <span>1. Create invoice</span>
          <span>→</span>
          <span>2. Client scans QR</span>
          <span>→</span>
          <span>3. Verified on-chain</span>
        </div>
      </div>
    ),
    size,
  );
}
