"""Hard certification / shift restriction checks."""

from __future__ import annotations

from typing import Any


def _norm_cert(c: str) -> str:
    return c.strip().upper().replace(" ", "_").replace("-", "_")


class CertificationEvaluator:
    def has_certifications(
        self,
        worker_certs: list[str],
        required: list[str],
    ) -> bool:
        if not required:
            return True
        have = {_norm_cert(c) for c in worker_certs}
        for req in required:
            r = _norm_cert(req)
            if r not in have and not any(r in h or h in r for h in have):
                return False
        return True

    def cert_match_score(self, worker_certs: list[str], required: list[str]) -> tuple[float, list[str]]:
        if not required:
            return 30.0, []
        if self.has_certifications(worker_certs, required):
            labels = ", ".join(required)
            return 30.0, [f"{labels} certified"]
        return 0.0, []

    def shift_restriction_blocks(
        self,
        scheduling: dict[str, Any],
        shift_band: str,
    ) -> bool:
        if not scheduling:
            return False
        nights_only = scheduling.get("nights_only") or scheduling.get("nightsOnly")
        days_only = scheduling.get("days_only") or scheduling.get("daysOnly")
        if nights_only and shift_band in ("day", "afternoon"):
            return True
        if days_only and shift_band == "night":
            return True
        return False
