import { ImageResponse } from "next/og";

export const alt = "ДоговорОфф — право для сложных решений";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          padding: "64px 72px",
          color: "#fafaf7",
          background: "linear-gradient(135deg, #050505 0%, #090b0c 58%, #10232b 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "-90px",
            display: "flex",
            width: "600px",
            height: "600px",
            border: "1px solid rgba(143,185,202,.42)",
            borderRadius: "50%",
            boxShadow: "0 0 110px rgba(143,185,202,.16)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            <div
              style={{
                display: "flex",
                width: "72px",
                height: "72px",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(143,185,202,.72)",
                color: "#8fb9ca",
                fontSize: 28,
                letterSpacing: "-0.08em",
              }}
            >
              DO
            </div>
            <div style={{ display: "flex", fontSize: 25, letterSpacing: "-0.02em" }}>DOGOVOROFF</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: "850px" }}>
            <div style={{ display: "flex", color: "#8fb9ca", fontSize: 18, letterSpacing: "0.18em" }}>
              LEGAL COMPANY · NIZHNEVARTOVSK
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "24px",
                fontSize: 70,
                fontWeight: 500,
                letterSpacing: "-0.045em",
                lineHeight: 1.02,
              }}
            >
              Precision for complex legal decisions.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "22px",
              borderTop: "1px solid rgba(255,255,255,.24)",
              color: "#a4a6a7",
              fontSize: 16,
              letterSpacing: "0.08em",
            }}
          >
            <span>TENDERS · ARBITRATION · BUSINESS · HOUSING</span>
            <span>RUSSIA · ONLINE</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
