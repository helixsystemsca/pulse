"""Inference: pluggable rules on the event bus — no hardcoded domain in the orchestrator."""

from app.core.inference.bootstrap import attach_inference_orchestrator
from app.core.inference.context import InferenceContext
from app.core.inference.derived_types import MAINTENANCE_INFERRED, TOOL_ASSIGNED, TOOL_MISSING
from app.core.inference.engine import InferenceEngine
from app.core.inference.orchestrator import InferenceOrchestrator
from app.core.inference.outcome import InferenceOutcome

__all__ = [
    "InferenceEngine",
    "InferenceContext",
    "InferenceOrchestrator",
    "InferenceOutcome",
    "attach_inference_orchestrator",
    "TOOL_ASSIGNED",
    "TOOL_MISSING",
    "MAINTENANCE_INFERRED",
]
