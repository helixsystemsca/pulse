"use client";

import Link from "next/link";
import { useOpsFacilities } from "@/lib/recreation/useOpsFacilities";

type Props = {
  id?: string;
  value: string;
  onChange: (facilityId: string) => void;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  required?: boolean;
};

export function FacilitySelect({
  id,
  value,
  onChange,
  disabled,
  className,
  emptyLabel = "Select a facility…",
  required,
}: Props) {
  const { facilities, loading, available } = useOpsFacilities();

  if (!available) {
    return (
      <p className="mt-1.5 text-xs text-ds-muted">
        Enable My Role / Facilities to pick a building.
      </p>
    );
  }

  if (!loading && facilities.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-ds-muted">
        No facilities yet.{" "}
        <Link href="/recreation/facilities?create=1" className="font-semibold text-ds-primary hover:underline">
          Add a facility
        </Link>{" "}
        first, then come back to link it.
      </p>
    );
  }

  return (
    <select
      id={id}
      className={className}
      disabled={disabled || loading}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{loading ? "Loading facilities…" : emptyLabel}</option>
      {facilities.map((f) => (
        <option key={f.id} value={f.id}>
          {f.title}
        </option>
      ))}
    </select>
  );
}
