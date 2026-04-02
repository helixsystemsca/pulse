"""Back-compat import path for automation event enrichment."""

from app.services.automation.event_enricher import EnrichResult, enrich_event

__all__ = ["enrich_event", "EnrichResult"]
