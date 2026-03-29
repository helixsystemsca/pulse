"""Wire the inference orchestrator to the process-wide event bus (call once at startup)."""

from __future__ import annotations

from app.core.events.engine import event_engine
from app.core.inference.orchestrator import InferenceOrchestrator
from app.core.inference.rules.registry import load_builtin_rules

_attached = False


def attach_inference_orchestrator() -> None:
    global _attached
    if _attached:
        return
    orch = InferenceOrchestrator(event_engine, load_builtin_rules())
    orch.attach()
    _attached = True
