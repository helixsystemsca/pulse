"""Vernon / BC recreation regulatory reference catalog.

Plain-language pointers to public sources. Not legal advice and not a substitute
for the official text. Do not paste copyrighted code or standard bodies here.
"""

from __future__ import annotations

from typing import Any, TypedDict

TOPIC_CATEGORIES: tuple[str, ...] = (
    "Chief Engineer",
    "OH&S",
    "Building Code",
    "Interior Health / Pools",
    "Refrigeration / TSBC",
    "Fire",
    "Electrical",
    "Playground",
    "Chemicals",
    "Emergency",
    "Other",
)

CLASSIFICATIONS: tuple[str, ...] = (
    "Law/Regulation",
    "Regulator guidance",
    "Municipal policy",
    "Industry standard",
    "Best practice",
    "Internal note",
)

VERIFICATION_STATUSES: tuple[str, ...] = (
    "Unverified",
    "Needs municipal confirmation",
    "Reviewed",
)

LIBRARY_HREF = "/recreation/regulations"
SEED_TAG = "vernon-starter"
LIBRARY_TAG = "regulatory-reference"
DISCLAIMER = (
    "Reference information only — not legal advice and not a municipal compliance "
    "determination. Pulse does not reproduce copyrighted code or standards. Confirm "
    "current wording on the official source and with City of Vernon / the regulator "
    "before relying on it for a decision."
)


class PulsePointer(TypedDict, total=False):
    label: str
    href: str
    match_title: str
    match_kind: str  # "procedure" | "knowledge" | "emergency" | "pm" | "contractor"


class ReferenceCard(TypedDict, total=False):
    key: str
    title: str
    topic_category: str
    summary: str
    applicability: str
    classification: str
    official_source_name: str
    official_source_url: str
    extra_sources: list[str]
    verification_status: str
    review_date: str  # ISO date; catalog review of the public URL, not legal sign-off
    authority: str
    regulation_name: str
    keywords: list[str]
    pulse_pointers: list[PulsePointer]


# Catalog review date for URLs checked while authoring / deepening this starter set.
_REVIEWED = "2026-09-16"

# Public regulator pages reused across Chief Engineer / Refrigeration cards.
PEBPVR_BC_LAWS = "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/104_2004"
PEBPVR_CANLII = "https://www.canlii.org/en/bc/laws/regu/bc-reg-104-2004/latest/bc-reg-104-2004.html"
TSBC_SO_BP_2017_02 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "safety-order-operation-ammonia-refrigeration-plants-public-occupancies"
)
TSBC_SO_BP_2017_02_PDF = (
    "https://files.technicalsafetybc.ca/v3/assets/bltdec2ded849740f4d/blt78da619d6d957596/"
    "63326e93cadf405032d0dd4e/safety_order_so-bp-2017-02_dec_22_2017.pdf"
)
TSBC_D_BP_2012_03 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "directive-temporary-absence-chief-engineer"
)
TSBC_D_BP_2012_03_PDF = (
    "https://files.technicalsafetybc.ca/v3/assets/bltdec2ded849740f4d/blt2aa0588545743a61/"
    "63326eafdb043b5366ce2afa/Chief_Engineer_Temporary_Absence_D-BP_2012-03.pdf"
)
TSBC_D_BP_2024_01 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "directive-general-supervision-and-risk-assessed-plant-registration-requirements"
)
TSBC_D_BP_2024_01_PDF = (
    "https://files.technicalsafetybc.ca/v3/assets/bltdec2ded849740f4d/blt1495b7df3881c9c8/"
    "65974e04dd0067bf122079aa/D-BP-2024-01-General-Supervision-and-Risk-Assessed-Status-Plant-Requirements.pdf"
)
TSBC_MAN_4000_PDF = (
    "https://files.technicalsafetybc.ca/v3/assets/bltdec2ded849740f4d/bltcd8e9240fe9049b3/"
    "65d4ef107475761541e47dc0/MAN-4000-04_-_Manual_for_General_Supervision_and_Risk_Assessed_Status_Plants.pdf"
)
TSBC_D_BP_2025_04 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "directive-plant-supervision-requirements-definition-of-immediate-vicinity"
)
TSBC_D_BP_2025_04_PDF = (
    "https://files.technicalsafetybc.ca/v3/assets/bltdec2ded849740f4d/blt4fff3cd1b405f15f/"
    "693b6272352bd2334601740e/Directive_D_BP-2025-04_Plant_Supervision_Requirements_Definition_of_Immediate_Vicinity.pdf"
)
TSBC_SPECIAL_STATUS_PLANTS = (
    "https://www.technicalsafetybc.ca/technologies/boilers-pressure-vessels/operating-permits/"
    "special-status-plants-general-supervision-risk-assessed"
)
TSBC_AMMONIA_AWARENESS = (
    "https://www.technicalsafetybc.ca/technologies/refrigeration/ammonia-safety-awareness-program"
)
TSBC_REFRIGERATION_OPERATOR = (
    "https://www.technicalsafetybc.ca/technologies/refrigeration/refrigeration-operator-certificate"
)
TSBC_ICE_FACILITY_OPERATOR = (
    "https://www.technicalsafetybc.ca/technologies/refrigeration/ice-facility-operator-certificate"
)

REFERENCE_CARDS: tuple[ReferenceCard, ...] = (
    {
        "key": "chief-engineer-plant-responsibility",
        "title": "Chief engineer / plant operator responsibility overview",
        "topic_category": "Chief Engineer",
        "classification": "Law/Regulation",
        "authority": "Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004)",
        "official_source_name": "Technical Safety BC — Directive D-BP 2012-03 (temporary absence of Chief Engineer)",
        "official_source_url": TSBC_D_BP_2012_03,
        "extra_sources": [
            TSBC_D_BP_2012_03_PDF,
            PEBPVR_BC_LAWS,
            PEBPVR_CANLII,
        ],
        "applicability": (
            "Arena ice plant / ammonia refrigeration and any other regulated boiler or refrigeration "
            "plant on City of Vernon recreation sites. Confirm the plant class on the operating permit "
            "before mapping certificate class to a named person. Pulse does not decide who is Vernon’s "
            "chief engineer."
        ),
        "summary": (
            "TSBC directive D-BP 2012-03 paraphrases how B.C. Reg. 104/2004 talks about a chief "
            "engineer (the power engineer the owner designates as responsible for operation and "
            "maintenance, including that regulated work is done by qualified people) and temporary "
            "absence. Public points on that notice — confirm current wording on the directive and "
            "the regulation; this is not a legal determination:\n"
            "• Appointment class vs plant class (s. 44): a plant class needs a power engineer with a "
            "corresponding or higher class appointed as chief engineer. Plant class follows the type "
            "and total capacity of equipment on the same header or refrigeration system.\n"
            "• Refrigeration plants (s. 44(2.1)): a refrigeration operator or a fourth-class or higher "
            "power engineer must be in charge.\n"
            "• Person in charge (s. 67): hold a certificate appropriate to the work; keep the plant "
            "adequately supervised with qualified people; staffing-level changes need written "
            "provincial safety manager approval. Plants that employ more than 24 power engineers "
            "need at least one assistant chief engineer.\n"
            "• Temporary absence not exceeding 96 hours (s. 70): the owner designates a shift "
            "engineer holding a certificate not less than one class lower than that required for "
            "chief engineer.\n"
            "• Longer than 96 hours: an assistant chief engineer is placed in charge, or the "
            "owner/chief engineer documents an appointment of someone who meets assistant-chief "
            "requirements.\n"
            "• Category “B” interim certificate: if no one holds the required class, an application "
            "may be made for a power engineer one class lower (in force up to 60 days, one renewal "
            "up to 30 days). See the directive and ss. 27–29 of the regulation for eligibility.\n"
            "Read the current regulation and TSBC notices for plant classification and attendance "
            "rules. Pulse does not decide who is legally the chief engineer at Vernon."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "chief engineer",
            "chief engineer responsibilities",
            "plant operator",
            "refrigeration plant",
            "power engineer",
            "person in charge",
            "temporary absence",
            "assistant chief engineer",
            "category b interim",
            "shift engineer",
            "section 44",
            "section 67",
            "section 70",
            "tsbc",
            "technical safety bc",
        ],
        "pulse_pointers": [
            {"label": "Ice plant PMs", "href": "/equipment"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-plant-supervision-vicinity",
        "title": "Plant supervision and “immediate vicinity” (TSBC)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Directive D-BP 2025-04 — Plant Supervision Requirements: Definition of Immediate Vicinity",
        "official_source_name": "Technical Safety BC — plant supervision / immediate vicinity (D-BP 2025-04)",
        "official_source_url": TSBC_D_BP_2025_04,
        "extra_sources": [
            TSBC_D_BP_2025_04_PDF,
            TSBC_D_BP_2024_01,
            TSBC_SPECIAL_STATUS_PLANTS,
            PEBPVR_BC_LAWS,
        ],
        "applicability": (
            "Regulated boiler and refrigeration plants, including arena ice plants, that are on "
            "continuous-supervision status (the default unless the plant is registered general "
            "supervision or risk assessed). Confirm the Civic Arena operating permit before treating "
            "this as the site attendance model."
        ),
        "summary": (
            "TSBC directive D-BP 2025-04 (December 2025) interprets ss. 11(2) and 45 of the Power "
            "Engineers regulation for continuous-supervision plants. Public points — confirm on the "
            "directive:\n"
            "• While the plant is in operation, the person in charge is expected to be in the "
            "boiler / refrigeration machinery / engine / turbine room, or in the “immediate vicinity "
            "within the plant premises.”\n"
            "• Immediate vicinity is the area where that person can stay in control of the plant and "
            "respond in time to upsets (monitor critical parameters and alarms, act, inspect). TSBC "
            "does not prescribe a fixed distance for every plant.\n"
            "• Plant premises are interpreted as the land, building, or structure where that machinery "
            "room sits, and no further than the legal land parcel.\n"
            "• If the person in charge may leave the machinery room, the owner and chief engineer must "
            "have written procedures (including an operational safety analysis) that define those "
            "boundaries. Procedures may be inspected.\n"
            "• Continuous supervision is the default. General supervision / risk-assessed status is a "
            "separate registered model (D-BP 2024-01 and MAN-4000). This card is not a site-specific "
            "attendance plan for Vernon Civic Arena."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "immediate vicinity",
            "plant supervision",
            "person in charge",
            "continuous supervision",
            "general supervision",
            "risk assessed",
            "refrigeration plant requirements",
            "d-bp 2025-04",
        ],
        "pulse_pointers": [
            {"label": "Daily ice plant rounds (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-ammonia-public-occupancy",
        "title": "Ammonia refrigeration in public occupancies (ice rinks)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Safety Order SO-BP 2017-02 — Operation of ammonia refrigeration plants in public occupancies",
        "official_source_name": "Technical Safety BC — ammonia plants in public occupancies (ice / curling rinks)",
        "official_source_url": TSBC_SO_BP_2017_02,
        "extra_sources": [
            TSBC_SO_BP_2017_02_PDF,
            "https://www.technicalsafetybc.ca/technologies/refrigeration/installation-permits",
            TSBC_ICE_FACILITY_OPERATOR,
            TSBC_REFRIGERATION_OPERATOR,
            PEBPVR_BC_LAWS,
        ],
        "applicability": (
            "Confirm whether the Civic Arena (or another Vernon ice/curling plant) is in scope of "
            "SO-BP 2017-02 before treating these bullets as binding. TSBC’s public order applies when "
            "all of the following are true: the facility is a public assembly occupancy (including ice "
            "rinks and curling rinks); the plant uses ammonia; capacity exceeds 50 kW; and the plant "
            "is a continuous-supervision status plant under s. 45 of the Power Engineers regulation. "
            "TSBC later published a clarification that the order did not add new regulatory "
            "requirements beyond the Act and that regulation — read the current page."
        ),
        "summary": (
            "Safety Order SO-BP 2017-02 is aimed at ammonia refrigeration in public assembly "
            "occupancies (ice and curling rinks). Public points on the order — confirm current "
            "wording and whether the plant is in scope:\n"
            "• Constant supervision: the owner must not allow the plant to operate unless an "
            "appropriately qualified person is in control of the plant and present on site in the "
            "immediate vicinity at all times while the plant is in operation.\n"
            "• Plant Supervision Program: the owner must create, implement, and maintain a "
            "documented program covering plant information (capacity in kW, operating permit, in-service "
            "date, refrigerant type and charge), personnel qualification records (including the "
            "designated chief engineer if applicable, and operators; certificates posted on site), "
            "and operating / ice-in–ice-out / shift schedules. Those documents must be available to "
            "a TSBC safety officer on request.\n"
            "• Appropriately qualified person: a 4th class (or higher) power engineer; a refrigeration "
            "operator; or an ice facility operator — the last only if the plant is a recreational ice "
            "facility plant, does not exceed 1,000 kW prime-mover nameplate, and the owner has "
            "designated a 4th class (or higher) power engineer or a refrigeration operator as chief "
            "engineer.\n"
            "• “Plant in operation”: the order defines this in terms of ammonia pressure (greater "
            "than 15 psig) unless the charge is pumped down into a receiver (or equivalent) and "
            "isolated. The order also states receiver fill and overpressure-protection conditions "
            "(CSA B52). Use the order for the exact wording — Pulse does not reproduce that "
            "definition in full.\n"
            "Installation / alteration of regulated refrigeration systems generally needs a TSBC "
            "installation permit unless an exemption applies."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ammonia",
            "ice rink",
            "curling",
            "public occupancy",
            "public assembly",
            "refrigeration plant",
            "safety order",
            "so-bp 2017-02",
            "continuous supervision",
            "plant supervision program",
            "ice facility operator",
            "arena",
        ],
        "pulse_pointers": [
            {
                "label": "Ammonia release — internal response",
                "match_title": "Ammonia release — internal response",
                "match_kind": "knowledge",
            },
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "worksafebc-ammonia-refrigeration",
        "title": "WorkSafeBC — ammonia in refrigeration systems",
        "topic_category": "OH&S",
        "classification": "Regulator guidance",
        "authority": "WorkSafeBC",
        "regulation_name": "WorkSafeBC guide: Ammonia in Refrigeration Systems (points to OHS Regulation Parts 5 and 6)",
        "official_source_name": "WorkSafeBC — Ammonia in Refrigeration Systems",
        "official_source_url": "https://www.worksafebc.com/en/resources/health-safety/books-guides/ammonia-in-refrigeration-systems?lang=en&direct",
        "extra_sources": [
            "https://www.worksafebc.com/en/resources/health-safety/risk-advisory/ammonia-exposure-during-storage-or-use",
            TSBC_AMMONIA_AWARENESS,
            TSBC_SO_BP_2017_02,
        ],
        "applicability": "Workplaces that use ammonia as a refrigerant, including ice rinks and similar recreation plants. Worker OH&S duties sit with the employer under the Workers Compensation Act / OHS Regulation — separate from TSBC plant qualification and from the Safety Order on public occupancies.",
        "summary": (
            "WorkSafeBC publishes a public guide for workplaces that use ammonia as a "
            "refrigerant (ice rinks are listed among typical sites). The guide points employers "
            "to the Occupational Health and Safety Regulation, including chemical / toxic process "
            "gas themes (risk assessment, exposure control, emergency planning). It is guidance "
            "that cites legal requirements — read the current OHS Regulation for the binding "
            "text. TSBC’s ammonia awareness page is a separate technical-safety source (owner "
            "monitoring, training, 24-hour incident reporting). This Pulse card does not reproduce "
            "the WorkSafeBC guide, the OHS Regulation, or TSBC notices."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "oh&s",
            "ohs",
            "worksafebc",
            "ammonia",
            "ice plant",
            "toxic process gas",
            "exposure control",
        ],
        "pulse_pointers": [
            {
                "label": "Ammonia release — internal SOP",
                "match_title": "Ammonia release — internal response",
                "match_kind": "procedure",
            },
            {"label": "Chemical spill — internal response", "match_title": "Chemical spill — internal response", "match_kind": "knowledge"},
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
            {"label": "Ice plant equipment", "href": "/equipment"},
        ],
    },
    {
        "key": "worksafebc-ohs-how-to-look-up",
        "title": "WorkSafeBC OH&S — how to look up the regulation",
        "topic_category": "OH&S",
        "classification": "Law/Regulation",
        "authority": "WorkSafeBC",
        "regulation_name": "Occupational Health and Safety Regulation (and Workers Compensation Act OH&S provisions)",
        "official_source_name": "WorkSafeBC — searchable OHS Regulation",
        "official_source_url": "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/",
        "extra_sources": [
            "https://www.worksafebc.com/en",
        ],
        "applicability": "All recreation workplaces under WorkSafeBC jurisdiction: arena, aquatic centre, community recreation centre, parks/playgrounds as workplaces for staff.",
        "summary": (
            "The OHS Regulation and the OH&S parts of the Workers Compensation Act are the "
            "legal workplace safety rules WorkSafeBC inspects against. Recreation-relevant "
            "themes typically include general conditions, emergency preparedness, WHMIS / "
            "chemicals, toxic process gases (ammonia), and machinery. Pulse does not paste "
            "regulation text. Use WorkSafeBC’s searchable regulation (and associated guidelines) "
            "for current wording, then confirm how the City applies it on site."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "oh&s",
            "ohs",
            "worksafebc",
            "occupational health",
            "workers compensation",
            "regulation",
        ],
        "pulse_pointers": [
            {"label": "Training / WHMIS tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Emergency Response", "href": "/recreation/emergency"},
        ],
    },
    {
        "key": "worksafebc-whmis-chemicals",
        "title": "Chemical handling and WHMIS (WorkSafeBC)",
        "topic_category": "Chemicals",
        "classification": "Law/Regulation",
        "authority": "WorkSafeBC",
        "regulation_name": "OHS Regulation Part 5 — WHMIS and hazardous products (see searchable regulation)",
        "official_source_name": "WorkSafeBC — searchable OHS Regulation (WHMIS / chemical agents)",
        "official_source_url": "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/",
        "extra_sources": [
            "https://www.worksafebc.com/en/health-safety/hazards-exposures/whmis",
        ],
        "applicability": "Pool chemical rooms, ice plant chemicals, cleaning products, and any hazardous products staff handle at recreation facilities.",
        "summary": (
            "WHMIS and broader chemical-agent rules live in the OHS Regulation (Part 5 themes: "
            "labels, SDS, training, storage, flammables, emergency planning). WorkSafeBC also "
            "hosts public WHMIS explainers. Confirm the current regulation and SDS for each "
            "product on site. This card does not list chemical recipes, neutralization steps, "
            "or copied SDS text."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "whmis",
            "chemical",
            "sds",
            "pool chemistry",
            "storage",
            "hazardous product",
        ],
        "pulse_pointers": [
            {"label": "Chemical spill — internal response", "match_title": "Chemical spill — internal response", "match_kind": "procedure"},
            {"label": "Pool equipment contractor", "href": "/recreation/contractors"},
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
        ],
    },
    {
        "key": "bc-building-code-how-it-applies",
        "title": "BC Building Code — how it applies and where to read it",
        "topic_category": "Building Code",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia",
        "regulation_name": "British Columbia Building Code (current edition on the provincial BC Codes pages)",
        "official_source_name": "Province of B.C. — BC Codes (Building, Plumbing, Fire)",
        "official_source_url": "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes",
        "extra_sources": [
            "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/building-code-resources",
            "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/2024-bc-codes",
            "https://www.vernon.ca/sites/default/files/docs/bylaws/5900_building_bylaw.pdf",
        ],
        "applicability": "New construction, alterations, repairs, and change of use for recreation buildings. Existing buildings are generally not rebuilt to the current code unless work or a change of use triggers it — the authority having jurisdiction (City of Vernon building officials) applies the code to a specific project.",
        "summary": (
            "The BC Building Code regulates how buildings are designed and constructed in B.C. "
            "(Vancouver has its own bylaw). Provincial pages explain that the codes are available "
            "from the official BC Codes site and that the Province does not give project-specific "
            "opinions — local building officials do. Pulse does not paste Building Code text "
            "(copyrighted). For a renovation, accessibility change, or occupancy question at a "
            "Vernon recreation facility, use the official code and City of Vernon Building Bylaw "
            "5900, and confirm with Building / Fire as needed."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "building code",
            "bc building code",
            "bcbc",
            "occupancy",
            "alteration",
            "permit",
        ],
        "pulse_pointers": [
            {"label": "Facility profiles", "href": "/recreation/facilities"},
            {"label": "Planning hub", "href": "/recreation/planning"},
        ],
    },
    {
        "key": "bc-fire-code-and-vernon-fire-bylaw",
        "title": "BC Fire Code highlights and Vernon Fire Services Bylaw",
        "topic_category": "Fire",
        "classification": "Municipal policy",
        "authority": "City of Vernon / Province of British Columbia",
        "regulation_name": "BC Fire Code (via provincial BC Codes) and City of Vernon Fire Services Bylaw 5635",
        "official_source_name": "City of Vernon — Fire Services Bylaw 5635 (adopts the Fire Code locally)",
        "official_source_url": "https://www.vernon.ca/sites/default/files/docs/bylaws/fire_services_bylaw_5635.pdf",
        "extra_sources": [
            "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes",
            "https://www.vernon.ca/government-services/bylaws",
        ],
        "applicability": "All recreation buildings: fire safety plans, exits, fire department access, storage of combustibles, and event/fireworks rules as the Fire Department applies them.",
        "summary": (
            "The BC Fire Code is part of the provincial BC Codes package. City of Vernon Fire "
            "Services Bylaw 5635 states that the current BC Fire Code is adopted and applicable "
            "in the City. Typical recreation ops themes (confirm in the current code and with "
            "Vernon Fire Rescue) include fire safety plans, exiting, and hazardous materials "
            "notifications. Pulse does not reproduce Fire Code text. For an operational fire "
            "response, use the internal Fire procedure in Pulse plus 911."
        ),
        "verification_status": "Needs municipal confirmation",
        "review_date": _REVIEWED,
        "keywords": [
            "fire code",
            "fire safety plan",
            "vernon fire",
            "bylaw 5635",
            "exits",
        ],
        "pulse_pointers": [
            {"label": "Fire — internal response", "match_title": "Fire — internal response", "match_kind": "procedure"},
            {"label": "Emergency contacts", "href": "/recreation/contacts"},
        ],
    },
    {
        "key": "interior-health-recreational-water",
        "title": "Interior Health — pools and recreational water",
        "topic_category": "Interior Health / Pools",
        "classification": "Regulator guidance",
        "authority": "Interior Health",
        "regulation_name": "Interior Health Environmental Public Health — recreational water / pool permits",
        "official_source_name": "Interior Health — Recreational Water Safety",
        "official_source_url": "https://www.interiorhealth.ca/services/recreational-water-safety",
        "extra_sources": [
            "https://www.interiorhealth.ca/services/environmental-health",
            "https://www.interiorhealth.ca/sites/default/files/PDFS/when-to-apply-for-construction-permit-for-pools.pdf",
            "https://www.interiorhealth.ca/sites/default/files/PDFS/pool-construction-application-permit-form.pdf",
        ],
        "applicability": "Vernon Aquatic Centre and any other public or commercial pool, hot tub, spray or wading pool in Interior Health’s region.",
        "summary": (
            "Interior Health Environmental Public Health inspects and approves commercial pools "
            "and hot tubs, and issues construction permits for public and commercial pools. IH "
            "public PDFs explain that a construction permit is needed before building or altering "
            "a public/commercial pool or spa, and that an operating permit is required before "
            "opening. Construction vs operating contacts are listed on IH forms (engineering vs "
            "EPH). This is a pointer to IH’s public pages — not a substitute for the facility’s "
            "current operating permit or pool safety plan."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "interior health",
            "pool code",
            "aquatic",
            "operating permit",
            "construction permit",
            "hot tub",
            "eph",
        ],
        "pulse_pointers": [
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Pool emergency — internal response", "match_title": "Drowning / pool emergency — internal response", "match_kind": "knowledge"},
        ],
    },
    {
        "key": "bc-pool-regulation",
        "title": "B.C. Pool Regulation — official text (public pools)",
        "topic_category": "Interior Health / Pools",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia",
        "regulation_name": "Pool Regulation, B.C. Reg. 296/2010 (Public Health Act)",
        "official_source_name": "BC Laws — Pool Regulation 296/2010",
        "official_source_url": "https://www.bclaws.gov.bc.ca/civix/document/id/crbc/crbc/296_2010",
        "extra_sources": [
            "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/08028_01",
        ],
        "applicability": "Public and commercial pools as defined in the regulation (swimming pools, hot tubs, spray and wading pools, with listed exceptions). Interior Health is the local health authority that administers this for Vernon.",
        "summary": (
            "The Pool Regulation is the provincial law for constructing and operating pools in "
            "B.C. Public BC Laws text covers operating permits, pool safety plans, water quality "
            "parameters, barriers, lifeguarding rules for public pools, and daily records. Pulse "
            "does not copy those numerical limits or staffing tables here — open the current "
            "regulation. Facility chemistry targets and EAPs in Pulse are internal operating "
            "records, not a reprint of the regulation."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "pool regulation",
            "pool code",
            "interior health pool",
            "lifeguard",
            "pool safety plan",
            "water quality",
            "public health act",
        ],
        "pulse_pointers": [
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Drowning / pool emergency — internal SOP", "match_title": "Drowning / pool emergency — internal response", "match_kind": "procedure"},
        ],
    },
    {
        "key": "pool-chemistry-public-health-angle",
        "title": "Pool water chemistry — public health angle (where to confirm)",
        "topic_category": "Interior Health / Pools",
        "classification": "Regulator guidance",
        "authority": "Interior Health / BC Laws",
        "regulation_name": "Pool Regulation water-quality duties + IH operating permit conditions",
        "official_source_name": "BC Laws — Pool Regulation (pool water) plus Interior Health recreational water",
        "official_source_url": "https://www.bclaws.gov.bc.ca/civix/document/id/crbc/crbc/296_2010",
        "extra_sources": [
            "https://www.interiorhealth.ca/services/recreational-water-safety",
        ],
        "applicability": "Vernon Aquatic Centre basins and spas on an Interior Health operating permit.",
        "summary": (
            "Public health expectations for disinfectant, pH, clarity, and circulation are in "
            "the Pool Regulation and in any extra conditions on the facility’s Interior Health "
            "operating permit — not in Pulse. Use the regulation and the posted permit / pool "
            "safety plan for numbers. Pulse daily water-quality PMs are internal checklists so "
            "staff record what the site actually measures. Do not treat a Pulse PM as the legal "
            "limit table."
        ),
        "verification_status": "Needs municipal confirmation",
        "review_date": _REVIEWED,
        "keywords": [
            "pool chemistry",
            "chlorine",
            "ph",
            "water quality",
            "aquatic",
            "interior health",
        ],
        "pulse_pointers": [
            {"label": "Daily water quality checks", "href": "/dashboard/pm-workspace"},
            {"label": "Chemical controller asset", "href": "/equipment"},
        ],
    },
    {
        "key": "tsbc-electrical-safety",
        "title": "Electrical safety pointers (Technical Safety BC)",
        "topic_category": "Electrical",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "Safety Standards Act and Electrical Safety Regulation (administered by TSBC except some municipalities)",
        "official_source_name": "Technical Safety BC — Electrical",
        "official_source_url": "https://www.technicalsafetybc.ca/technologies/electrical",
        "extra_sources": [
            "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/legislation/safety-standards",
            "https://www.technicalsafetybc.ca/technologies/electrical/installation-permits",
        ],
        "applicability": "Electrical equipment and systems in recreation facilities. Installation work generally needs a licensed contractor, an FSR, and a permit. Vernon is not one of the Lower Mainland municipalities that issue their own electrical permits — confirm current jurisdiction on TSBC’s site.",
        "summary": (
            "TSBC oversees electrical equipment under the Safety Standards Act and Electrical "
            "Safety Regulation. Public pages cover installation permits, operating permits, and "
            "the need for licensed contractors / Field Safety Representatives. The Canadian "
            "Electrical Code itself is copyrighted (CSA) — do not copy it into Pulse. For "
            "facility electrical work, use a licensed contractor and the current permit path."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "electrical",
            "electrical safety",
            "fsr",
            "permit",
            "canadian electrical code",
            "tsbc",
        ],
        "pulse_pointers": [
            {"label": "Contractors", "href": "/recreation/contractors"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "playground-csa-z614",
        "title": "Playground equipment — CSA Z614 pointer",
        "topic_category": "Playground",
        "classification": "Industry standard",
        "authority": "CSA Group",
        "regulation_name": "CSA Z614 — Children’s playground equipment and surfacing",
        "official_source_name": "CSA Group store — CSA Z614:20 (R2025)",
        "official_source_url": "https://www.csagroup.org/store/product/CSA%20Z614:20/",
        "extra_sources": [
            "https://www.vernon.ca/parks-recreation",
        ],
        "applicability": "Outdoor public-use playgrounds (parks, recreation sites). Confirm whether City of Vernon Parks has adopted Z614 (or another inspection standard) as municipal policy — Pulse does not assume that.",
        "summary": (
            "CSA Z614 is the Canadian industry standard for public-use playground equipment and "
            "surfacing. The standard is sold by CSA and is copyrighted — Pulse will not quote "
            "clauses, dimensions, or surfacing depths. Use the CSA publication and the City’s "
            "parks inspection practice. Treat this card as a finding aid, not a playground audit."
        ),
        "verification_status": "Needs municipal confirmation",
        "review_date": _REVIEWED,
        "keywords": [
            "playground",
            "csa z614",
            "playspace",
            "surfacing",
            "parks",
        ],
        "pulse_pointers": [
            {"label": "Facilities", "href": "/recreation/facilities"},
            {"label": "Inspections / logs", "href": "/dashboard/compliance"},
        ],
    },
    {
        "key": "emergency-ammonia-internal-plus-regulators",
        "title": "Ammonia emergency — internal procedure plus regulator pointers",
        "topic_category": "Emergency",
        "classification": "Internal note",
        "authority": "City of Vernon recreation (internal) — with WorkSafeBC / TSBC public pages",
        "regulation_name": "Internal operating procedure (not a regulatory citation)",
        "official_source_name": "WorkSafeBC — ammonia refrigeration guide (emergency planning is in the OHS Regulation)",
        "official_source_url": "https://www.worksafebc.com/en/resources/health-safety/books-guides/ammonia-in-refrigeration-systems?lang=en&direct",
        "extra_sources": [
            TSBC_SO_BP_2017_02,
            TSBC_AMMONIA_AWARENESS,
        ],
        "applicability": "Vernon Civic Arena ice plant / ammonia refrigeration room and adjacent public areas.",
        "summary": (
            "Life-safety response for an ammonia release is: follow the City emergency plan, "
            "evacuate, call 911, and do not re-enter without training and PPE. Pulse stores an "
            "internal response card and SOP so staff can find those steps quickly. Those Pulse "
            "records are labelled internal — they are not TSBC or WorkSafeBC citations.\n"
            "Separately, TSBC’s ammonia safety awareness page states that owners and operators "
            "of refrigeration systems must report ammonia releases to Technical Safety BC within "
            "24 hours of the incident or release, as stated in the Safety Standards Act. That "
            "regulator report is not the same as calling 911 or following the municipal EAP. Use "
            "the linked regulator pages for employer emergency-planning themes, and keep the "
            "municipal plan as the operational source of truth."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ammonia release",
            "emergency",
            "ice plant",
            "evacuate",
            "911",
            "24 hour report",
            "incident reporting",
        ],
        "pulse_pointers": [
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
            {
                "label": "Ammonia release — internal response",
                "match_title": "Ammonia release — internal response",
                "match_kind": "knowledge",
            },
            {
                "label": "Ammonia release — internal SOP",
                "match_title": "Ammonia release — internal response",
                "match_kind": "procedure",
            },
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "safety-standards-act-overview",
        "title": "Safety Standards Act — technical safety umbrella",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia",
        "regulation_name": "Safety Standards Act",
        "official_source_name": "Province of B.C. — Safety Standards Act overview",
        "official_source_url": "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/legislation/safety-standards",
        "extra_sources": [
            "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/03039_01",
            "https://www.technicalsafetybc.ca/",
            TSBC_AMMONIA_AWARENESS,
            PEBPVR_BC_LAWS,
        ],
        "applicability": "Boilers, pressure vessels, refrigeration, electrical, gas, elevators, amusement rides, and related regulated equipment on recreation sites.",
        "summary": (
            "The Safety Standards Act is the provincial statute behind Technical Safety BC’s "
            "permits, qualifications, assessments, and incident follow-up. A government overview "
            "lists the equipment classes it covers. TSBC is the delegated administrator for most "
            "of the province; a few municipalities handle electrical/gas permits. For ice plant "
            "and electrical work in Vernon, start with TSBC plus the specific regulation (power "
            "engineers / electrical). TSBC’s ammonia awareness page also points owners to a "
            "24-hour ammonia-release report to TSBC under this Act — that is a regulator notice, "
            "not a substitute for 911 or the municipal EAP. Read the Act on BC Laws for legal wording."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "safety standards act",
            "technical safety bc",
            "bc safety authority",
            "permits",
            "regulated equipment",
        ],
        "pulse_pointers": [
            {"label": "Codes & Guidance library", "href": "/recreation/regulations"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Electrical work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-general-supervision-risk-assessed",
        "title": "General supervision / risk-assessed plant registration (TSBC)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Directive D-BP 2024-01 — General Supervision and Risk Assessed Plant Registration Requirements",
        "official_source_name": "Technical Safety BC — general supervision and risk-assessed plant registration (D-BP 2024-01)",
        "official_source_url": TSBC_D_BP_2024_01,
        "extra_sources": [
            TSBC_D_BP_2024_01_PDF,
            TSBC_MAN_4000_PDF,
            TSBC_SPECIAL_STATUS_PLANTS,
            PEBPVR_BC_LAWS,
        ],
        "applicability": (
            "Boiler and refrigeration plants that apply for (or already hold) special-status "
            "registration. TSBC’s public special-status page states that plants in an institution "
            "or public occupancy are not eligible for general supervision registration — risk "
            "assessed is the special-status path discussed for those occupancies. Refrigeration "
            "plants up to 1,000 kW prime-mover nameplate may be eligible for either status if "
            "other conditions are met. Confirm Vernon Civic Arena’s actual operating-permit "
            "status; many ice plants remain continuous supervision. Pulse does not register plants."
        ),
        "summary": (
            "Directive D-BP 2024-01 (January 2024) explains the difference between continuous "
            "supervision and the two special-status models. Public points — confirm on the "
            "directive, MAN-4000, and the operating permit:\n"
            "• Continuous supervision (s. 45): plants that are not registered general supervision "
            "or risk assessed must have the person in charge present at all times in the machinery "
            "room or immediate vicinity while the plant is in operation.\n"
            "• General supervision (ss. 54 and 55) and risk assessed (ss. 54 and 56): registered "
            "special plants that may operate with reduced on-site attendance under the regulation "
            "and terms set by a provincial safety manager.\n"
            "• MAN-4000 is the provincial safety manager’s manual of minimum technical and "
            "administrative requirements to obtain and keep that registration (s. 54(3)).\n"
            "• When a power engineer or refrigeration operator is required to be on the premises "
            "(ss. 55(2) and 56(2)(a)), the directive’s terms say they must thoroughly inspect the "
            "plant (boilers, refrigeration systems, vessels, piping, fuel, fittings, safety devices, "
            "ancillary equipment) as soon as practical after the start of the shift, and verify "
            "controls, safety devices, and remote monitoring before leaving.\n"
            "• Changes to the accepted plant configuration, capacity, or safety and management "
            "program must be reported to TSBC. This card is not an application and is not a "
            "determination that Vernon holds special status."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "general supervision",
            "risk assessed",
            "special status",
            "continuous supervision",
            "man-4000",
            "d-bp 2024-01",
            "plant registration",
            "shift inspection",
            "refrigeration plant requirements",
        ],
        "pulse_pointers": [
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Daily ice plant rounds (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-ammonia-safety-awareness",
        "title": "Ammonia safety awareness — owner duties and release reporting (TSBC)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "Technical Safety BC Ammonia Safety Awareness Program (points to the Safety Standards Act)",
        "official_source_name": "Technical Safety BC — Ammonia Safety Awareness Program",
        "official_source_url": TSBC_AMMONIA_AWARENESS,
        "extra_sources": [
            TSBC_SO_BP_2017_02,
            "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/legislation/safety-standards",
        ],
        "applicability": (
            "Owners and managers of ammonia refrigeration plants, including ice arenas and curling "
            "rinks. TSBC’s public page states a monitoring duty for plants exceeding 50 kW. Confirm "
            "how that applies to the Civic Arena plant capacity and staffing model."
        ),
        "summary": (
            "TSBC’s ammonia safety awareness page is a public briefing, not a substitute for the "
            "Safety Order or the Power Engineers regulation. Public points — confirm on the page:\n"
            "• Hazard: ammonia is toxic (and at high concentration can also be a fire/explosion "
            "hazard). Exposure can burn skin, eyes, and lungs; high concentrations can be fatal. "
            "If there is a release, notify a supervisor, clear the area, and begin emergency "
            "procedures.\n"
            "• Owner / manager duty: facility owners and managers are responsible for safe "
            "operation of their technical systems. TSBC states it is their job to ensure ammonia "
            "refrigeration plants exceeding 50 kW are monitored and continuously controlled by a "
            "qualified and certified individual.\n"
            "• Training and programs: anyone in charge of a refrigeration plant is required to "
            "complete specific safety training and know what to do in an emergency. Safety systems "
            "(such as alarms) must be installed, tested, and maintained; owners/operators must "
            "implement operation and maintenance safety programs.\n"
            "• Reporting: owners and operators of refrigeration systems must report ammonia "
            "releases to Technical Safety BC within 24 hours of the incident or release, as stated "
            "in the Safety Standards Act. That report is in addition to 911 and the municipal EAP.\n"
            "The program was developed after ammonia incidents (including Fernie Memorial Arena). "
            "Pulse does not reproduce training course content."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ammonia safety awareness",
            "ammonia",
            "toxic",
            "50 kw",
            "24 hour report",
            "incident reporting",
            "owner duty",
            "ice arena",
            "curling",
        ],
        "pulse_pointers": [
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
            {
                "label": "Ammonia release — internal SOP",
                "match_title": "Ammonia release — internal response",
                "match_kind": "procedure",
            },
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-refrigeration-operator-certificate",
        "title": "Refrigeration Operator certificate — person in charge (TSBC)",
        "topic_category": "Chief Engineer",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation — refrigeration operator certificate of qualification",
        "official_source_name": "Technical Safety BC — Refrigeration Operator certificate",
        "official_source_url": TSBC_REFRIGERATION_OPERATOR,
        "extra_sources": [
            TSBC_ICE_FACILITY_OPERATOR,
            PEBPVR_BC_LAWS,
            TSBC_D_BP_2012_03,
        ],
        "applicability": (
            "Anyone who may be person-in-charge of a refrigeration plant of any type or size, "
            "including an arena ice plant. This card describes the public certificate page — it "
            "does not say who at Vernon holds (or must hold) the ticket. Pulse does not decide "
            "who is the chief engineer."
        ),
        "summary": (
            "TSBC’s public certificate page states that a Refrigeration Operator certificate "
            "allows the holder to be the person-in-charge of any type and size of refrigeration "
            "plant. That lines up with s. 44(2.1) of B.C. Reg. 104/2004 (refrigeration operator "
            "or fourth-class or higher power engineer in charge) as explained on D-BP 2012-03. "
            "Public process notes on the certificate page (confirm current wording there — not "
            "an application checklist from Pulse):\n"
            "• Eligibility paths include a refrigeration mechanic credential under the Industry "
            "Training Authority Act, an approved refrigeration operator course, or an equivalent "
            "technical background approved by a provincial safety manager.\n"
            "• Exam: 100 multiple-choice questions, three hours, 65% pass mark; certificate valid "
            "three years.\n"
            "• Evaluation after exams includes plant operating experience (TSBC lists refrigerant "
            "group / capacity thresholds and form 1026). Use the TSBC page and the regulation for "
            "those numbers.\n"
            "An Ice Facility Operator certificate is a different, narrower ticket (see the related "
            "card). Record actual staff tickets in Pulse certifications; do not treat this summary "
            "as proof of qualification."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "refrigeration operator",
            "refrigeration operator certificate",
            "person in charge",
            "certificate of qualification",
            "fourth class",
            "4th class",
            "chief engineer",
            "ice plant ticket",
        ],
        "pulse_pointers": [
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-ice-facility-operator-certificate",
        "title": "Ice Facility Operator certificate (TSBC)",
        "topic_category": "Chief Engineer",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation — ice facility operator certificate of qualification",
        "official_source_name": "Technical Safety BC — Ice Facility Operator certificate",
        "official_source_url": TSBC_ICE_FACILITY_OPERATOR,
        "extra_sources": [
            TSBC_REFRIGERATION_OPERATOR,
            TSBC_SO_BP_2017_02,
            PEBPVR_BC_LAWS,
        ],
        "applicability": (
            "Recreational ice-facility plants that do not exceed a 1,000 kW prime-mover nameplate "
            "rating and that have a Refrigeration Operator or a Fourth Class Power Engineer as "
            "chief engineer — the limits stated on TSBC’s public certificate page and in Safety "
            "Order SO-BP 2017-02. Confirm plant capacity and who the owner has designated as chief "
            "engineer. Pulse does not decide that designation."
        ),
        "summary": (
            "TSBC’s Ice Facility Operator certificate is a narrower operator ticket than "
            "Refrigeration Operator. The public page states it allows the holder to operate an "
            "ice facility plant that does not exceed 1,000 kW prime-mover nameplate and that has "
            "a Refrigeration Operator or a Fourth Class Power Engineer as chief engineer of the "
            "plant. Safety Order SO-BP 2017-02 uses the same three conditions when listing an ice "
            "facility operator as an “appropriately qualified person” for ammonia plants in public "
            "occupancies.\n"
            "Public process notes (confirm on the TSBC page): approved ice facility operator "
            "course; 100-question exam (three hours, 65%); evaluation includes at least 30 days’ "
            "experience operating an ice facility plant; certificate valid three years.\n"
            "This card does not say the Civic Arena is within 1,000 kW or that a named employee is "
            "qualified. Record tickets in Pulse certifications and confirm plant class with TSBC / "
            "the operating permit."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ice facility operator",
            "ice facility operator certificate",
            "ifo",
            "1000 kw",
            "1,000 kw",
            "chief engineer",
            "artificial ice",
            "arena",
            "curling",
        ],
        "pulse_pointers": [
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
        ],
    },
)


def cards_by_key() -> dict[str, ReferenceCard]:
    return {c["key"]: c for c in REFERENCE_CARDS}


def seed_tag_for(key: str) -> str:
    return f"seed-key:{key}"


# Intent phrases used by OpsAsk / Copilot / unified search.
INTENT_SYNONYMS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "chief_engineer",
        (
            "chief engineer",
            "chief engineer responsibilities",
            "plant operator responsibility",
            "person in charge",
            "power engineer",
            "temporary absence",
            "assistant chief engineer",
            "refrigeration operator",
            "ice facility operator",
        ),
    ),
    (
        "ohs",
        ("oh&s", "ohs", "occupational health", "worksafebc", "worksafe", "workers compensation"),
    ),
    (
        "building_code",
        ("building code", "bc building code", "bcbc", "plumbing code"),
    ),
    (
        "interior_health_pools",
        (
            "interior health",
            "interior health pool",
            "pool code",
            "pool regulation",
            "aquatic code",
            "operating permit pool",
        ),
    ),
    (
        "refrigeration_plant",
        (
            "refrigeration plant",
            "refrigeration plant requirements",
            "ice plant",
            "ammonia",
            "tsbc",
            "technical safety",
            "bc safety authority",
            "safety order",
            "continuous supervision",
            "general supervision",
            "risk assessed",
            "ammonia safety awareness",
        ),
    ),
    ("fire", ("fire code", "fire safety plan", "vernon fire")),
    ("electrical", ("electrical safety", "electrical code", "electrical permit")),
    ("playground", ("playground", "csa z614", "playspace")),
    ("chemicals", ("whmis", "chemical storage", "chemical handling", "sds")),
    ("emergency_ammonia", ("ammonia release", "ammonia emergency", "ammonia response")),
)

INTENT_TO_CARD_KEYS: dict[str, tuple[str, ...]] = {
    "chief_engineer": (
        "chief-engineer-plant-responsibility",
        "tsbc-refrigeration-operator-certificate",
        "tsbc-ice-facility-operator-certificate",
        "tsbc-plant-supervision-vicinity",
        "tsbc-ammonia-public-occupancy",
        "safety-standards-act-overview",
    ),
    "ohs": (
        "worksafebc-ohs-how-to-look-up",
        "worksafebc-ammonia-refrigeration",
        "worksafebc-whmis-chemicals",
    ),
    "building_code": ("bc-building-code-how-it-applies",),
    "interior_health_pools": (
        "interior-health-recreational-water",
        "bc-pool-regulation",
        "pool-chemistry-public-health-angle",
    ),
    "refrigeration_plant": (
        "chief-engineer-plant-responsibility",
        "tsbc-plant-supervision-vicinity",
        "tsbc-ammonia-public-occupancy",
        "tsbc-general-supervision-risk-assessed",
        "tsbc-ammonia-safety-awareness",
        "tsbc-refrigeration-operator-certificate",
        "tsbc-ice-facility-operator-certificate",
        "worksafebc-ammonia-refrigeration",
        "safety-standards-act-overview",
    ),
    "fire": ("bc-fire-code-and-vernon-fire-bylaw",),
    "electrical": ("tsbc-electrical-safety",),
    "playground": ("playground-csa-z614",),
    "chemicals": ("worksafebc-whmis-chemicals", "pool-chemistry-public-health-angle"),
    "emergency_ammonia": (
        "emergency-ammonia-internal-plus-regulators",
        "tsbc-ammonia-public-occupancy",
        "tsbc-ammonia-safety-awareness",
        "worksafebc-ammonia-refrigeration",
    ),
}


def catalog_as_public_dicts() -> list[dict[str, Any]]:
    """JSON-safe catalog for tests and optional API exposure."""
    out: list[dict[str, Any]] = []
    for card in REFERENCE_CARDS:
        out.append(
            {
                "key": card["key"],
                "title": card["title"],
                "topic_category": card["topic_category"],
                "classification": card["classification"],
                "official_source_name": card["official_source_name"],
                "official_source_url": card["official_source_url"],
                "verification_status": card["verification_status"],
                "review_date": card.get("review_date"),
                "applicability": card["applicability"],
                "summary": card["summary"],
                "keywords": list(card.get("keywords") or []),
            }
        )
    return out
