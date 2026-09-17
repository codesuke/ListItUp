import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site-metadata";

export const alt =
  "ListItUp — turn scattered intentions into clear, useful lists";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(
    join(
      process.cwd(),
      "public",
      "brand",
      "listitup-ribbon-concept-v3-porcelain.png"
    ),
    "base64"
  );

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 82% 24%, #34201d 0%, #171717 42%, #111111 100%)",
        color: "#f8f6ef",
        display: "flex",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px 76px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#ff6b4a",
          height: "8px",
          left: 0,
          position: "absolute",
          top: 0,
          width: "100%",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "690px",
        }}
      >
        <div
          style={{
            color: "#ff8a70",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            marginBottom: "24px",
            textTransform: "uppercase",
          }}
        >
          Capture · Organize · Complete
        </div>
        <div
          style={{
            fontSize: "82px",
            fontWeight: 700,
            letterSpacing: "-0.055em",
            lineHeight: 1,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            color: "#d8d5cd",
            fontSize: "34px",
            lineHeight: 1.3,
            marginTop: "28px",
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          background: "#22201f",
          border: "1px solid #403c39",
          borderRadius: "56px",
          display: "flex",
          height: "330px",
          justifyContent: "center",
          width: "330px",
        }}
      >
        <img
          alt=""
          height={275}
          src={`data:image/png;base64,${logo}`}
          width={275}
        />
      </div>
    </div>,
    size
  );
}
