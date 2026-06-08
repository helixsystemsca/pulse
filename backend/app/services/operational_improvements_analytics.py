"""Prioritization matrix and analytics helpers for operational improvements."""

from __future__ import annotations

from collections import Counter
from typing import Any, Optional


def prioritization_quadrant(impact: int, effort: int) -> str:
    """Map impact/effort scores (1-5) to improvement matrix quadrant."""
    impact = max(1, min(5, impact))
    effort = max(1, min(5, effort))
    if impact >= 4 and effort <= 2:
        return "quick_win"
    if impact >= 4 and effort >= 3:
        return "major_project"
    if impact <= 3 and effort <= 2:
        return "fill_in"
    return "low_priority"


def prioritization_from_framework(framework_data: dict[str, Any] | None) -> Optional[str]:
    fw = framework_data or {}
    pri = fw.get("prioritization") or {}
    quadrant = pri.get("quadrant")
    if isinstance(quadrant, str) and quadrant.strip():
        return quadrant.strip()
    impact = pri.get("impact")
    effort = pri.get("effort")
    if isinstance(impact, int) and isinstance(effort, int):
        return prioritization_quadrant(impact, effort)
    return None


def parse_savings(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip().replace(",", "").replace("$", "")
    if not raw:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        return 0.0


def extract_root_cause_labels(analyses: list[Any]) -> list[str]:
    labels: list[str] = []
    for analysis in analyses:
        atype = getattr(analysis, "analysis_type", None) or (analysis.get("analysis_type") if isinstance(analysis, dict) else None)
        data = getattr(analysis, "data", None) or (analysis.get("data") if isinstance(analysis, dict) else {}) or {}
        if atype == "root_cause_5_whys":
            rc = str(data.get("root_cause") or "").strip()
            if rc:
                labels.append(rc)
            else:
                whys = data.get("whys") or []
                for w in whys:
                    s = str(w).strip()
                    if s:
                        labels.append(s)
        elif atype == "fishbone":
            for cat in (data.get("categories") or {}).values():
                if isinstance(cat, list):
                    for c in cat:
                        s = str(c).strip()
                        if s:
                            labels.append(s)
            for f in data.get("contributing_factors") or []:
                s = str(f).strip()
                if s:
                    labels.append(s)
    return labels


def extract_waste_category_counts(analyses: list[Any]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for analysis in analyses:
        atype = getattr(analysis, "analysis_type", None) or (analysis.get("analysis_type") if isinstance(analysis, dict) else None)
        if atype != "lean_waste":
            continue
        data = getattr(analysis, "data", None) or (analysis.get("data") if isinstance(analysis, dict) else {}) or {}
        for item in data.get("wastes") or []:
            if not isinstance(item, dict):
                continue
            key = str(item.get("waste_type") or item.get("type") or "unknown").strip() or "unknown"
            counts[key] += 1
    return counts


def top_counter_entries(counter: Counter[str], limit: int = 8) -> list[dict[str, Any]]:
    return [{"label": k, "count": v} for k, v in counter.most_common(limit)]
