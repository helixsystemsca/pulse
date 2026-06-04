"use client";

type Props = {
  value: string;
  size?: number;
  className?: string;
};

/** QR image scaffold — swap generator implementation without changing callers. */
export function QrCodeImage({ value, size = 256, className }: Props) {
  const src = `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=${size}&margin=1`;
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
