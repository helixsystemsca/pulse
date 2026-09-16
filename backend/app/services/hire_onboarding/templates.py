"""Default BC municipal recreation hire document template (insert-if-missing)."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

DEFAULT_TEMPLATE_NAME = "Default hire packet"

# Plant / ice / ammonia items attach when department or job title matches these tokens.
PLANT_ROLE_TOKENS = (
    "plant",
    "ammonia",
    "ice plant",
    "ice-plant",
    "arena",
    "refrigerat",
    "machinery",
    "chief engineer",
    "chief-engineer",
    "tsbc",
)

DEFAULT_TEMPLATE_ITEMS: tuple[dict[str, Any], ...] = (
    {
        "key": "emergency_contact",
        "title": "Emergency contact",
        "description": "Record a primary emergency contact for this hire.",
        "kind": "review",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "Confirm a primary emergency contact name, relationship, and phone number is on file "
            "for this employee before they work unsupervised."
        ),
    },
    {
        "key": "whmis_ohs",
        "title": "WHMIS / OH&S acknowledgment",
        "description": "WorkSafeBC WHMIS and workplace health & safety orientation.",
        "kind": "sign",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "I acknowledge I have been informed of workplace health and safety expectations, "
            "including WHMIS (Workplace Hazardous Materials Information System) awareness, "
            "how to report hazards, and the right to refuse unsafe work."
        ),
    },
    {
        "key": "facility_orientation",
        "title": "Facility orientation",
        "description": "Site walkthrough: access, emergency exits, first aid, radios.",
        "kind": "review",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "Complete a facility orientation covering access/egress, emergency exits, assembly "
            "points, first-aid locations, radio or phone procedures, and any area-specific hazards."
        ),
    },
    {
        "key": "code_of_conduct",
        "title": "Code of conduct",
        "description": "Municipal recreation conduct expectations.",
        "kind": "sign",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "I acknowledge the City recreation code of conduct: professional behaviour with the "
            "public and coworkers, respectful workplace standards, and reporting of incidents."
        ),
    },
    {
        "key": "privacy_confidentiality",
        "title": "Privacy / confidentiality",
        "description": "FOIPPA and personal-information handling.",
        "kind": "sign",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "I acknowledge I will handle personal information in accordance with municipal privacy "
            "requirements (including FOIPPA) and will not share patron or employee information "
            "outside authorized work use."
        ),
    },
    {
        "key": "role_sop",
        "title": "Role SOP acknowledgment",
        "description": "Position-specific standard operating procedures.",
        "kind": "sign",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "I acknowledge I have reviewed the standard operating procedures for my assigned role "
            "and will follow them, including asking a supervisor before performing unfamiliar work."
        ),
    },
    {
        "key": "ppe",
        "title": "PPE acknowledgment",
        "description": "Required personal protective equipment for the role.",
        "kind": "sign",
        "applies_when": "always",
        "is_required": True,
        "body_text": (
            "I acknowledge the personal protective equipment required for this role (as assigned) "
            "and will wear and maintain it as directed."
        ),
    },
    {
        "key": "ammonia_machinery",
        "title": "Ammonia / machinery-room awareness",
        "description": "Restricted plant access and ammonia emergency awareness (plant roles).",
        "kind": "review",
        "applies_when": "plant_role",
        "is_required": True,
        "body_text": (
            "I understand the ice plant / machinery room is a restricted area. I will not enter "
            "without authorization, I know the ammonia alarm response, and I will follow the plant "
            "emergency procedure posted at the facility."
        ),
    },
)


def new_template_item_id() -> str:
    return str(uuid4())


def seeded_template_items() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for spec in DEFAULT_TEMPLATE_ITEMS:
        rows.append({**spec, "id": new_template_item_id()})
    return rows
