"use client";

import { qrImageSrc } from "@/lib/qr/qrResourceService";
import { qrScanUrl } from "@/lib/qr/qr-scan-url";

type Props = {
  value: string;
  token?: string;
  size?: number;
  className?: string;
};

/** Prefer same-origin PNG from Pulse; fall back to encoded scan URL if token unknown. */
export function QrCodeImage({ value, token, size = 256, className }: Props) {
  const src = token
    ? qrImageSrc(token, "png")
    : `https://quickchart.io/qr?text=${encodeURIComponent(qrScanUrl(value))}&size=${size}&margin=1`;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}
