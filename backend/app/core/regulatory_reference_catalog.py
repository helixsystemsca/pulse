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
TSBC_REFRIGERATION_HOME = "https://www.technicalsafetybc.ca/technologies/refrigeration"
TSBC_D_BP_2025_02 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "directive-secondary-coolant-systems"
)
TSBC_IB_DA_2020_01 = (
    "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/"
    "information-bulletin-design-registration-refrigeration-plants-and-systems"
)
TSBC_REFRIGERATION_DESIGN_REG = (
    "https://www.technicalsafetybc.ca/technologies/refrigeration/refrigeration-design-registration"
)
TSBC_AMUSEMENT_DEVICES = "https://www.technicalsafetybc.ca/technologies/amusement-devices"
TSBC_AMUSEMENT_DEVICES_REGULATED = (
    "https://www.technicalsafetybc.ca/technologies/amusement-devices/regulated-amusement-devices-in-bc"
)

# Interior Health / Ministry of Health — recreational water (pools).
IH_REC_WATER_PERMITS = (
    "https://www.interiorhealth.ca/health-and-wellness/environmental-health-and-hazards/"
    "recreational-water-permits-and-resources"
)
IH_REC_WATER_SAFETY = "https://www.interiorhealth.ca/services/recreational-water-safety"
IH_WHEN_CONSTRUCTION_PERMIT = (
    "https://www.interiorhealth.ca/sites/default/files/PDFS/when-to-apply-for-construction-permit-for-pools.pdf"
)
IH_POOL_PERMIT_FORM = (
    "https://www.interiorhealth.ca/sites/default/files/PDFS/pool-construction-application-permit-form.pdf"
)
IH_MINOR_POOL_WORKS = (
    "https://www.interiorhealth.ca/sites/default/files/PDFS/guidance-for-minor-pool-works.pdf"
)
POOL_REG_BC_LAWS = "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/296_2010"
POOL_REG_CANLII = "https://www.canlii.org/en/bc/laws/regu/bc-reg-296-2010/latest/bc-reg-296-2010.html"
PUBLIC_HEALTH_ACT_BC_LAWS = "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/08028_01"
MOH_REC_WATER = (
    "https://www2.gov.bc.ca/gov/content/environment/air-land-water/water/water-quality/recreational-water-quality"
)
MOH_POOL_DESIGN_PDF = (
    "https://www2.gov.bc.ca/assets/gov/environment/air-land-water/water/documents/"
    "bc_guideline_for_pool_design_april_2025_v3_-_final.pdf"
)
MOH_POOL_OPERATIONS_PDF = (
    "https://www2.gov.bc.ca/assets/gov/environment/air-land-water/water/documents/"
    "bc_guideline_for_pool_operation_april_2025_v3_-_final.pdf"
)
MOH_POOL_SAFETY_PLAN_PDF = "https://www2.gov.bc.ca/assets/gov/health/forms/guide_and_pool_safety_plan.pdf"

# WorkSafeBC — recreation-relevant OH&S.
WSBC_OHS_SEARCHABLE = (
    "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/"
)
WSBC_OHS_PART5 = (
    "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/"
    "ohs-regulation/part-05-chemical-and-biological-substances"
)
WSBC_OHS_PART6 = (
    "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/"
    "ohs-regulation/part-06-substance-specific-requirements"
)
WSBC_OHS_G6 = (
    "https://www.worksafebc.com/en/law-policy/occupational-health-safety/searchable-ohs-regulation/"
    "ohs-guidelines/guidelines-part-06"
)
WSBC_WHMIS = "https://www.worksafebc.com/en/health-safety/hazards-exposures/whmis"
WSBC_AMMONIA_GUIDE = (
    "https://www.worksafebc.com/en/resources/health-safety/books-guides/ammonia-in-refrigeration-systems?lang=en&direct"
)
WSBC_AMMONIA_ADVISORY = (
    "https://www.worksafebc.com/en/resources/health-safety/risk-advisory/ammonia-exposure-during-storage-or-use?lang=en"
)
WSBC_AMMONIA_HAZARD = "https://www.worksafebc.com/en/health-safety/hazards-exposures/ammonia"
WSBC_AMMONIA_CHECKLIST = (
    "https://www.worksafebc.com/en/resources/health-safety/checklist/"
    "anhydrous-ammonia-safety-industrial-refrigeration-systems-guide?lang=en"
)
WSBC_CHLORINE_ADVISORY = (
    "https://www.worksafebc.com/en/resources/health-safety/risk-advisory/chlorine-exposure-during-storage-or-use"
)
WSBC_CHLORINE_SWP = "https://www.worksafebc.com/en/resources/health-safety/books-guides/safe-work-practices-chlorine"
WSBC_CHLORAMINES_ARTICLE = (
    "https://www.worksafebc.com/en/about-us/news-events/worksafe-magazine/articles/2025/summer/"
    "controlling-chemical-exposure-in-pools"
)
WSBC_CHLORAMINES = "https://www.worksafebc.com/en/health-safety/hazards-exposures/chloramines"
WSBC_CHLORAMINES_SWP = (
    "https://www.worksafebc.com/en/resources/health-safety/books-guides/chloramines-safe-work-practices"
)

# Building / fire / industry practice.
BC_CODES = "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes"
BC_CODES_RESOURCES = (
    "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/"
    "bc-codes/building-code-resources"
)
BC_CODES_2024 = (
    "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/2024-bc-codes"
)
BC_CODES_ACCESSIBILITY = (
    "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/"
    "bc-codes/2024-bc-codes/accessibility"
)
VERNON_BUILDING_BYLAW_PDF = "https://www.vernon.ca/sites/default/files/docs/bylaws/5900_building_bylaw.pdf"
VERNON_FIRE_BYLAW_PDF = "https://www.vernon.ca/sites/default/files/docs/bylaws/fire_services_bylaw_5635.pdf"
VERNON_BYLAWS = "https://www.vernon.ca/government-services/bylaws"
BCRPA_POOLSAFE_RESOURCES = "https://www.bcrpa.bc.ca/courses/poolsafe-bc/resources/"
BCRPA_POOLSAFE_PDF = "https://www.bcrpa.bc.ca/media/48734/poolsafebc-best-practices-guide-web-pdf.pdf"
CSA_Z614 = "https://www.csagroup.org/store/product/CSA%20Z614:20/"
VERNON_PARKS_REC = "https://www.vernon.ca/parks-recreation"


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
        "official_source_url": WSBC_AMMONIA_GUIDE,
        "extra_sources": [
            WSBC_AMMONIA_ADVISORY,
            WSBC_AMMONIA_HAZARD,
            WSBC_AMMONIA_CHECKLIST,
            WSBC_OHS_PART6,
            TSBC_AMMONIA_AWARENESS,
            TSBC_SO_BP_2017_02,
        ],
        "applicability": (
            "Workplaces that use ammonia as a refrigerant. WorkSafeBC’s public risk advisory lists "
            "public pools and ice rinks among those workplaces; the refrigeration guide lists ice "
            "rinks, cold storage, food processing, and ice manufacturing. Worker OH&S duties sit "
            "with the employer under the Workers Compensation Act / OHS Regulation — separate from "
            "TSBC plant qualification and from the Safety Order on public occupancies. Pulse does "
            "not decide whether Vernon’s ice plant is in scope of a given WorkSafeBC document."
        ),
        "summary": (
            "WorkSafeBC’s public guide is written for workplaces that use ammonia as a refrigerant. "
            "Ice rinks are listed among typical sites. Public points — confirm on the guide, the "
            "risk advisory, and the searchable OHS Regulation; this is not a legal determination:\n"
            "• Recreation angle: the ammonia risk advisory lists public pools and ice rinks, and "
            "local government, among workplaces that may use ammonia as a refrigerant. The hazards "
            "page likewise names ice rinks and ice manufacturing plants.\n"
            "• Toxic process gas: the advisory points to OHS Regulation ss. 6.116–6.132 (risk "
            "assessment, exposure control plan, procedures, enclosure, testing, ventilation, "
            "emergency ventilation, shut-down, PPE, monitors/alarms, maintenance).\n"
            "• Exposure control plan: the Regulation requires an exposure control plan meeting "
            "s. 5.54. The guide also points to WHMIS (Part 5) and employer emergency planning.\n"
            "• Companion checklist: WorkSafeBC publishes a public anhydrous-ammonia self-assessment "
            "for industrial refrigeration. That landing page names food and beverage processing and "
            "cold storage — use it as a finding aid, not as proof that it was written for Civic Arena.\n"
            "• TSBC is a separate technical-safety source (owner monitoring, training, 24-hour "
            "incident reporting). This Pulse card does not reproduce the guide or the regulation."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "oh&s",
            "ohs",
            "worksafebc",
            "ammonia",
            "ice plant",
            "ice rink",
            "toxic process gas",
            "exposure control",
            "section 5.54",
            "6.116",
            "anhydrous ammonia",
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
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
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
        "official_source_url": WSBC_OHS_SEARCHABLE,
        "extra_sources": [
            WSBC_OHS_PART5,
            WSBC_OHS_PART6,
            WSBC_OHS_G6,
            "https://www.worksafebc.com/en",
        ],
        "applicability": (
            "All recreation workplaces under WorkSafeBC jurisdiction: arena, aquatic centre, "
            "community recreation centre, and parks/playgrounds as workplaces for staff. This card "
            "is a finding aid for the regulation — not a site-specific OH&S program."
        ),
        "summary": (
            "The OHS Regulation and the OH&S parts of the Workers Compensation Act are the legal "
            "workplace safety rules WorkSafeBC inspects against. Pulse does not paste regulation "
            "text. Use the searchable regulation (and associated guidelines) for current wording, "
            "then confirm how the City applies it on site.\n"
            "Recreation-relevant look-ups — confirm current numbering on WorkSafeBC:\n"
            "• Part 5 (chemical and biological substances): WHMIS, hazardous products, exposure "
            "control plans (s. 5.54 is the section WorkSafeBC’s chlorine and ammonia advisories "
            "cite), and emergency-planning themes for hazardous substances.\n"
            "• Part 6 (substance-specific requirements): toxic process gases at ss. 6.116–6.132 "
            "(chlorine and ammonia are named on the public risk advisories). Guidelines G6.116–"
            "G6.127 sit beside those sections.\n"
            "• Other Parts (general conditions, emergency preparedness, machinery, confined "
            "space) may also apply — search the regulation rather than relying on this card.\n"
            "Pool public-health chemistry is Interior Health / the Pool Regulation. Ice-plant "
            "qualification is TSBC. Those are parallel, not substitutes for OH&S."
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
            "part 5",
            "part 6",
            "toxic process gas",
            "section 5.54",
            "worksafebc recreation",
        ],
        "pulse_pointers": [
            {"label": "Training / WHMIS tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Emergency Response", "href": "/recreation/emergency"},
            {"label": "Facility profiles", "href": "/recreation/facilities"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Checklists", "href": "/recreation/checklists"},
        ],
    },
    {
        "key": "worksafebc-whmis-chemicals",
        "title": "Chemical handling and WHMIS (WorkSafeBC)",
        "topic_category": "Chemicals",
        "classification": "Law/Regulation",
        "authority": "WorkSafeBC",
        "regulation_name": "OHS Regulation Part 5 — WHMIS and hazardous products (see searchable regulation)",
        "official_source_name": "WorkSafeBC — WHMIS (Workplace Hazardous Materials Information System)",
        "official_source_url": WSBC_WHMIS,
        "extra_sources": [
            WSBC_OHS_PART5,
            WSBC_OHS_SEARCHABLE,
            WSBC_CHLORINE_ADVISORY,
        ],
        "applicability": (
            "Pool chemical rooms, ice plant chemicals, cleaning products, and any hazardous "
            "products staff handle at recreation facilities. WHMIS sits under OHS Regulation Part 5 "
            "— it is not a substitute for Interior Health pool-water rules or for TSBC plant rules."
        ),
        "summary": (
            "WHMIS is the workplace system for hazardous products (labels and safety data sheets). "
            "WorkSafeBC’s public WHMIS page and OHS Regulation Part 5 are the places to confirm "
            "current wording. Public points — confirm on those pages; Pulse does not copy SDS text "
            "or chemical recipes:\n"
            "• Each hazardous product needs a label and an SDS. A label identifies hazards and "
            "precautions; an SDS has more detail. Employers must keep a WHMIS program, label "
            "products, make SDSs available, and train workers.\n"
            "• Training must meet ss. 5.6 and 5.7 of the OHS Regulation. WorkSafeBC does not "
            "itself offer WHMIS certification and does not endorse one trainer over another.\n"
            "• Recreation angle: pool disinfectant and pH-adjustment chemicals, ice-plant chemicals, "
            "and custodial products are typical hazardous products on a rec site. Chlorine gas, "
            "where used, is also a toxic process gas (see the chlorine risk-advisory card).\n"
            "This card does not list neutralization steps, mixing instructions, or copied SDS text."
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
            "pool chemical",
            "chlorine",
        ],
        "pulse_pointers": [
            {"label": "Chemical spill — internal response", "match_title": "Chemical spill — internal response", "match_kind": "procedure"},
            {"label": "Pool equipment contractor", "href": "/recreation/contractors"},
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Chemical controller asset", "href": "/equipment"},
            {"label": "Training / WHMIS tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
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
        "official_source_url": BC_CODES,
        "extra_sources": [
            BC_CODES_RESOURCES,
            BC_CODES_2024,
            BC_CODES_ACCESSIBILITY,
            VERNON_BUILDING_BYLAW_PDF,
        ],
        "applicability": (
            "New construction, alterations, repairs, demolitions, and change of use for recreation "
            "buildings (arena, aquatic centre, CRC). Existing buildings are generally not rebuilt "
            "to the current code unless work or a change of use triggers it — the authority having "
            "jurisdiction (City of Vernon building officials) applies the code to a specific project. "
            "Pulse does not paste Building Code text (copyrighted)."
        ),
        "summary": (
            "The BC Building Code regulates how buildings are designed and constructed in B.C. "
            "(Vancouver has its own bylaw). Provincial pages explain that the codes are available "
            "from the official BC Codes site and that the Province does not give project-specific "
            "opinions — local building officials do. Public points from those government pages — "
            "confirm current wording there; do not treat this as a code extract:\n"
            "• Application: the provincial resources page states the Building and Plumbing Codes "
            "apply when a building is being built, and to existing buildings when making changes "
            "or changing their use. New work and parts affected by that work are in scope.\n"
            "• Registered professionals: the same page states architects/engineers are always "
            "required for complex buildings (Part 3 buildings in the Code) and sometimes for small "
            "buildings (Part 9). Project-specific questions go to the City of Vernon, including "
            "Building Bylaw 5900.\n"
            "• Accessibility (2024 public summary for new commercial and public buildings and "
            "their common spaces): power-operated doors on building and accessible washroom "
            "entrances; an elevator in large two- and three-storey buildings; a full-sized changing "
            "space in universal washrooms. The Code does not set furniture layout or building "
            "operations. Pulse will not invent occupancy-group or article numbers beyond what "
            "those public pages state.\n"
            "For a renovation, accessibility change, or occupancy question at a Vernon recreation "
            "facility, use the official code and the City, not this summary."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "building code",
            "bc building code",
            "bcbc",
            "occupancy",
            "assembly",
            "accessibility",
            "alteration",
            "permit",
            "part 3",
        ],
        "pulse_pointers": [
            {"label": "Facility profiles", "href": "/recreation/facilities"},
            {"label": "Planning hub", "href": "/recreation/planning"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Contractors", "href": "/recreation/contractors"},
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
        "official_source_url": VERNON_FIRE_BYLAW_PDF,
        "extra_sources": [
            BC_CODES,
            VERNON_BYLAWS,
            WSBC_CHLORINE_ADVISORY,
            WSBC_AMMONIA_ADVISORY,
        ],
        "applicability": (
            "All recreation buildings (arena, aquatic centre, CRC) as existing buildings and "
            "during construction or events: fire safety plans, exits, fire-department access, "
            "storage of combustibles, and hazardous-materials themes as Vernon Fire Rescue applies "
            "them. Confirm the current bylaw PDF and the provincial Fire Code — Pulse does not "
            "reproduce Fire Code text."
        ),
        "summary": (
            "The provincial BC Codes page describes the BC Fire Code as a provincial regulation on "
            "fire safety for existing buildings and facilities and those under construction. City "
            "of Vernon Fire Services Bylaw 5635 states that the current BC Fire Code is adopted "
            "and applicable in the City (confirm in the posted bylaw PDF). Public points — confirm "
            "with Vernon Fire Rescue and the official code:\n"
            "• Recreation ops themes typically include fire safety plans, exiting, fire-department "
            "access, combustibles storage, and event / fireworks rules as the Fire Department "
            "applies them. Arenas, pools, and community halls are public assembly-style buildings "
            "in ordinary municipal fire practice — this card does not assign a Building Code "
            "occupancy group.\n"
            "• WorkSafeBC’s chlorine and ammonia risk advisories note that the BC Fire Code and "
            "Part 3 of the BC Building Code also place duties on employers for storage and handling "
            "of flammable substances. That is a workplace pointer, not a substitute for the Fire "
            "Code or the bylaw.\n"
            "For an operational fire response, use the internal Fire procedure in Pulse plus 911. "
            "This summary is not a fire-safety plan for Civic Arena or the aquatic centre."
        ),
        "verification_status": "Needs municipal confirmation",
        "review_date": _REVIEWED,
        "keywords": [
            "fire code",
            "fire safety plan",
            "vernon fire",
            "bylaw 5635",
            "exits",
            "assembly",
            "arena",
            "pool",
        ],
        "pulse_pointers": [
            {"label": "Fire — internal response", "match_title": "Fire — internal response", "match_kind": "procedure"},
            {"label": "Emergency contacts", "href": "/recreation/contacts"},
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
            {"label": "Facility profiles", "href": "/recreation/facilities"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "interior-health-recreational-water",
        "title": "Interior Health — recreational water permits and resources",
        "topic_category": "Interior Health / Pools",
        "classification": "Regulator guidance",
        "authority": "Interior Health",
        "regulation_name": "Interior Health Environmental Public Health — recreational water / pool permits (Pool Regulation)",
        "official_source_name": "Interior Health — Recreational Water Permits & Resources",
        "official_source_url": IH_REC_WATER_PERMITS,
        "extra_sources": [
            IH_WHEN_CONSTRUCTION_PERMIT,
            IH_POOL_PERMIT_FORM,
            IH_MINOR_POOL_WORKS,
            IH_REC_WATER_SAFETY,
            MOH_REC_WATER,
            TSBC_AMUSEMENT_DEVICES_REGULATED,
        ],
        "applicability": (
            "Vernon Aquatic Centre and any other public or commercial pool, hot tub, spray or "
            "wading pool in Interior Health’s region. The Pool Regulation does not govern ice "
            "arenas — arena plants stay under TSBC / WorkSafeBC / building and fire as applicable. "
            "This card is not a substitute for the facility’s current operating permit."
        ),
        "summary": (
            "Interior Health’s public permits page is the regional starting point for public and "
            "commercial pools and hot tubs. Public points — confirm on the IH page and PDFs; "
            "Pulse does not issue permits:\n"
            "• Construction: IH says you must receive approval before constructing a new public "
            "or commercial swimming pool or hot tub. The “when to apply” PDF says a construction "
            "permit is needed before construction, installation, alteration, or renovation of a "
            "public or commercial pool or spa. Public Health Engineers review against the Pool "
            "Regulation and the B.C. Guidelines for Pool Design. Construction applications go to "
            "EngineeringDirect@interiorhealth.ca (Penticton Protection Office is listed on the form).\n"
            "• Operating: an operating permit is required before the pool is open for use. "
            "Operating-permit applications go to EPHDirect@interiorhealth.ca. The construction/"
            "operating form also asks whether the facility uses an approved drinking-water supply "
            "— that is a public-health form question, not a full Drinking Water Protection Act "
            "program card.\n"
            "• Minor works: IH publishes guidance that some drain-cover, liner, or basin-refinish "
            "work may be waived after PHE review — still submit the application; do not assume a "
            "waiver.\n"
            "• Operator courses listed on the IH page (contact EPH for current acceptance): BCRPA "
            "Level I & II; Resident Managers' Training Institute CSPO; RFABC Level I & II and "
            "Chlorine Safe Handling; BC Lifesaving Society; plus introductory training via the "
            "regional EPH office.\n"
            "• Waterslides: the IH construction form asks whether a waterslide is associated and "
            "points some slides to BC Safety Authority / Elevating Devices Safety Regulation. "
            "TSBC’s public amusement-device list includes waterslides over 3.03 m. That is TSBC "
            "amusement-device permitting, not an Interior Health operating permit."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "interior health",
            "pool code",
            "aquatic",
            "operating permit",
            "construction permit",
            "pool permit",
            "hot tub",
            "eph",
            "engineeringdirect",
            "ephdirect",
            "waterslide",
        ],
        "pulse_pointers": [
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Pool emergency — internal response", "match_title": "Drowning / pool emergency — internal response", "match_kind": "knowledge"},
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Pool equipment / chemical controller", "href": "/equipment"},
            {"label": "Pool contractors", "href": "/recreation/contractors"},
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Lifeguard / operator tickets", "href": "/training/compliance/workers?panel=certifications"},
        ],
    },
    {
        "key": "bc-pool-regulation",
        "title": "B.C. Pool Regulation — official text (public pools)",
        "topic_category": "Interior Health / Pools",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia",
        "regulation_name": "Pool Regulation, B.C. Reg. 296/2010 (Public Health Act)",
        "official_source_name": "BC Laws — Pool Regulation, B.C. Reg. 296/2010",
        "official_source_url": POOL_REG_BC_LAWS,
        "extra_sources": [
            POOL_REG_CANLII,
            PUBLIC_HEALTH_ACT_BC_LAWS,
            IH_REC_WATER_PERMITS,
            MOH_REC_WATER,
        ],
        "applicability": (
            "Public and commercial pools as defined in the regulation: swimming pools, hot tubs, "
            "spray pools, and wading pools, with listed exceptions (private residential pools, "
            "in-room hotel tubs, and other exclusions in s. 2). Interior Health is the local "
            "health authority that administers this for Vernon. Ice arenas are not pools under "
            "this regulation."
        ),
        "summary": (
            "The Pool Regulation (Public Health Act) is the provincial law for constructing and "
            "operating pools in B.C. Pulse does not reprint the regulation. Public themes — "
            "confirm current wording on BC Laws or CanLII:\n"
            "• Construction permit (s. 5): do not construct (including repair, renovation, or "
            "alteration) without a permit and sealed engineer/architect plans, unless a health "
            "officer waives a minor or emergency repair.\n"
            "• Operating permit (s. 6): required before operating; not transferable; post it; "
            "expires on the stated date or one year. First issue / after construction needs a "
            "professional statement of compliance and a pool safety plan (s. 13).\n"
            "• Enclosure and rules (ss. 7–8): barrier with controlled access; posted rules "
            "(illness, shower, running, fouling, child supervision, diving only in designated "
            "areas).\n"
            "• Water quality and maintenance (ss. 10–11): clarity, temperature, pH, alkalinity, "
            "disinfectant, combined chlorine, circulation, suction/entrapment, lighting, slip "
            "resistance, depth markings, safe chemical storage. Numerical limits live in s. 10 "
            "and Schedule 3 — open the regulation; do not treat a Pulse PM as that table.\n"
            "• Safety plan, supervision, records (ss. 13, 17–19): written plan, staff training, "
            "annual review; public-pool lifeguard plus an additional trained person; daily "
            "records of injuries, fecal/vomit events, chemicals added, and required tests.\n"
            "Facility chemistry targets and EAPs in Pulse are internal operating records, not a "
            "reprint of the regulation."
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
            "pool permit",
            "enclosure",
            "296/2010",
        ],
        "pulse_pointers": [
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Drowning / pool emergency — internal SOP", "match_title": "Drowning / pool emergency — internal response", "match_kind": "procedure"},
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Lifeguard / operator tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "pool-chemistry-public-health-angle",
        "title": "Pool water chemistry — public health angle (where to confirm)",
        "topic_category": "Interior Health / Pools",
        "classification": "Regulator guidance",
        "authority": "Interior Health / BC Laws",
        "regulation_name": "Pool Regulation water-quality duties + IH operating permit conditions",
        "official_source_name": "BC Laws — Pool Regulation (pool water) plus Interior Health recreational water permits",
        "official_source_url": POOL_REG_BC_LAWS,
        "extra_sources": [
            IH_REC_WATER_PERMITS,
            MOH_POOL_OPERATIONS_PDF,
            WSBC_CHLORAMINES_ARTICLE,
        ],
        "applicability": (
            "Vernon Aquatic Centre basins and spas on an Interior Health operating permit. Public "
            "health water-quality duties are in the Pool Regulation and any extra conditions on "
            "the posted permit — not in Pulse. Indoor air / chloramines are a separate WorkSafeBC "
            "workplace topic."
        ),
        "summary": (
            "Public health expectations for disinfectant, pH, clarity, combined chlorine, "
            "alkalinity, temperature, and circulation are in Pool Regulation s. 10 and Schedule 3, "
            "and in any extra conditions on the facility’s Interior Health operating permit. Pulse "
            "does not reprint those numerical limits. Public themes — confirm on BC Laws and the "
            "permit:\n"
            "• Testing frequency in the regulation includes twice-daily disinfectant, pH, and "
            "combined chlorine checks, weekly alkalinity (and cyanuric acid if used), plus clarity "
            "and design-flow circulation while the pool is in use.\n"
            "• Combined chlorine in pool water is a public-health limit in s. 10. Airborne "
            "chloramines at indoor pools are a WorkSafeBC workplace-air topic (no B.C. occupational "
            "exposure limit; see the chloramines card) — do not mix the two tables.\n"
            "• A health officer may impose different chemical requirements for a specified pool "
            "(s. 10(3.1)). Use the posted permit / pool safety plan for the numbers that apply "
            "here.\n"
            "Pulse daily water-quality PMs are internal checklists so staff record what the site "
            "actually measures. Do not treat a Pulse PM as the legal limit table."
        ),
        "verification_status": "Needs municipal confirmation",
        "review_date": _REVIEWED,
        "keywords": [
            "pool chemistry",
            "chlorine",
            "combined chlorine",
            "chloramine",
            "ph",
            "water quality",
            "aquatic",
            "interior health",
            "schedule 3",
        ],
        "pulse_pointers": [
            {"label": "Daily water quality checks", "href": "/dashboard/pm-workspace"},
            {"label": "Chemical controller asset", "href": "/equipment"},
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
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
            TSBC_AMUSEMENT_DEVICES,
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
        "official_source_url": CSA_Z614,
        "extra_sources": [
            VERNON_PARKS_REC,
        ],
        "applicability": (
            "Outdoor public-use playgrounds (parks, recreation sites). Confirm whether City of "
            "Vernon Parks has adopted Z614 (or another inspection standard) as municipal policy — "
            "Pulse does not assume that. This is an industry-standard pointer, not a law card."
        ),
        "summary": (
            "CSA Z614 is the Canadian industry standard for public-use playground equipment and "
            "surfacing. The standard is sold by CSA and is copyrighted — Pulse will not quote "
            "clauses, dimensions, or surfacing depths. Use the CSA publication and the City’s "
            "parks inspection practice. Treat this card as a finding aid, not a playground audit.\n"
            "Playground sites are also workplaces for parks/recreation staff (WorkSafeBC OH&S). "
            "Large dry slides that fall outside playground code may be TSBC amusement devices — "
            "see TSBC’s regulated-amusement-device list, not this standard."
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
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
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
        "official_source_url": WSBC_AMMONIA_GUIDE,
        "extra_sources": [
            WSBC_AMMONIA_ADVISORY,
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
    {
        "key": "pebpvrsr-chief-engineer-definition-duties",
        "title": "PEBPVRSR — chief engineer definition, s.68–70 duties (pointer)",
        "topic_category": "Chief Engineer",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia / Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004) ss. 1, 68–70",
        "official_source_name": "BC Laws — Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004)",
        "official_source_url": PEBPVR_BC_LAWS,
        "extra_sources": [
            TSBC_REFRIGERATION_HOME,
            TSBC_D_BP_2012_03,
            PEBPVR_CANLII,
        ],
        "applicability": (
            "Owner-designated chief engineer, assistant chief engineer, shift engineer, and person "
            "in charge for regulated plants on recreation sites, including the Civic Arena ice plant. "
            "Pulse does not decide who is Vernon’s chief engineer."
        ),
        "summary": (
            "This card points at the public PEBPVRSR text on BC Laws (and TSBC’s refrigeration "
            "page, which lists that regulation). It is a finding aid — not legal advice and not a "
            "substitute for the current section wording. Public hooks to open:\n"
            "• Definition (s. 1): a chief engineer is a power engineer designated by the owner to "
            "be responsible for operation and maintenance of a plant, and for ensuring that "
            "regulated work in the plant is performed by appropriately qualified persons.\n"
            "• s. 68 (chief engineer requirements): with written permission of a provincial safety "
            "manager, a power engineer may at any one time be the chief engineer of a limited "
            "number of plants (the current public text distinguishes heating-type plants from "
            "refrigeration plants). If two or more power engineers are employed in a plant, the "
            "owner or person in charge must designate one as chief engineer.\n"
            "• s. 69: work that may affect operation and safety of the plant (including "
            "refrigeration plant equipment) needs prior approval of the chief engineer, assistant "
            "chief engineer, or the person in charge.\n"
            "• s. 70: when the chief engineer is away from the plant, the owner designates a shift "
            "engineer (certificate class not less than one class lower than that required for "
            "chief engineer). TSBC D-BP 2012-03 interprets temporary absence — see the related "
            "chief-engineer overview card.\n"
            "Confirm current wording on BC Laws before relying on any of these points."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "chief engineer",
            "chief engineer definition",
            "chief engineer duties",
            "chief engineer responsibilities",
            "person in charge",
            "shift engineer",
            "assistant chief engineer",
            "section 68",
            "s.68",
            "multi-plant",
            "prior approval",
            "section 69",
            "section 70",
            "pebpvrsr",
            "tsbc",
            "ice plant",
        ],
        "pulse_pointers": [
            {"label": "Codes & Guidance library", "href": "/recreation/regulations"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "pebpvrsr-refrigeration-in-charge-classification",
        "title": "PEBPVRSR — refrigeration in charge and A3/B2L capacity hooks (pointer)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Law/Regulation",
        "authority": "Province of British Columbia / Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004) — plant class / in-charge hooks",
        "official_source_name": "BC Laws — Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004)",
        "official_source_url": PEBPVR_BC_LAWS,
        "extra_sources": [
            TSBC_REFRIGERATION_HOME,
            TSBC_REFRIGERATION_OPERATOR,
            TSBC_ICE_FACILITY_OPERATOR,
            PEBPVR_CANLII,
        ],
        "applicability": (
            "Arena ice plants and other regulated refrigeration plants. Classification depends on "
            "refrigerant group (including A3 / B2L such as ammonia) and total prime-mover capacity. "
            "Confirm the Civic Arena plant against the current regulation — Pulse will not calculate "
            "Vernon’s class from this card."
        ),
        "summary": (
            "PEBPVRSR classifies refrigeration plants and sets who may be in charge. Open the "
            "current regulation on BC Laws; this is not legal advice and Pulse does not reproduce "
            "CSA B52. Public hooks (confirm current wording and whether an exemption or special "
            "status applies):\n"
            "• s. 6 lists when a certificate of qualification is not required to operate certain "
            "equipment, including a prime-mover capacity threshold for refrigerant groups A3, B2L, "
            "B2 or B3 (ammonia is treated as B2L in that CSA grouping — read the regulation and "
            "the adopted code for the current grouping).\n"
            "• s. 44(2.1): a refrigeration plant requires a refrigeration operator or a "
            "fourth-class or higher power engineer to be in charge.\n"
            "• s. 46.1: refrigeration plant capacity is the total kW of connected prime-mover "
            "nameplate ratings.\n"
            "• Ice-facility operator provisions (including a 1,000 kW recreational-ice limit and "
            "the need for a refrigeration operator or fourth-class+ person in charge) live in the "
            "same regulation and on TSBC’s certificate pages.\n"
            "Do not treat this card as a class calculator or a staffing plan for Vernon."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "in charge",
            "person in charge",
            "refrigeration operator",
            "fourth class",
            "4th class",
            "plant classification",
            "a3",
            "b2l",
            "ammonia",
            "capacity",
            "50 kw",
            "ice facility operator",
            "ice plant",
            "pebpvrsr",
            "tsbc",
        ],
        "pulse_pointers": [
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-secondary-coolant-overpressure",
        "title": "TSBC directive — secondary coolant systems (testing and overpressure)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Directive D-BP 2025-02 — Secondary Coolant Systems",
        "official_source_name": "Technical Safety BC — Directive: Secondary Coolant Systems (D-BP 2025-02)",
        "official_source_url": TSBC_D_BP_2025_02,
        "extra_sources": [
            TSBC_IB_DA_2020_01,
            TSBC_REFRIGERATION_HOME,
            PEBPVR_BC_LAWS,
        ],
        "applicability": (
            "Regulated refrigeration systems that use a secondary coolant (brine / glycol loops on "
            "ice plants and similar). The public directive describes Part B as applying to new "
            "installations after CSA B52:23 adoption and to existing ammonia refrigeration systems "
            "— confirm whether Vernon’s plant is in scope."
        ),
        "summary": (
            "TSBC’s December 2025 public directive (D-BP 2025-02) clarifies secondary-coolant "
            "testing, maintenance, and overpressure protection under PEBPVRSR. Public points — "
            "confirm on the directive; Pulse does not paste CSA B52 clauses:\n"
            "• Part A (testing and maintenance) is described as applying to existing and new "
            "refrigeration systems. Owners establish testing practices proportionate to risk. For "
            "toxic and/or flammable refrigerants (the page lists classes including B2L, which "
            "includes ammonia), secondary-coolant testing is described as no less than twice per "
            "year unless an alternative frequency is justified by a documented risk assessment.\n"
            "• Refrigerant detected in the secondary coolant is to be reported to TSBC; analysis "
            "records are retained (the page states a minimum retention period).\n"
            "• Part B (overpressure protection) is described as applying to new installations after "
            "adoption of CSA B52:23, existing ammonia refrigeration systems, and replaced/added "
            "components connected to the secondary coolant. Uncertified systems address secondary-"
            "coolant design during TSBC design registration (IB-DA 2020-01).\n"
            "This card is not a Civic Arena testing schedule or a design specification."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "secondary coolant",
            "overpressure",
            "brine",
            "glycol",
            "heat exchanger",
            "ammonia",
            "ice plant",
            "d-bp 2025-02",
            "testing",
            "tsbc",
            "refrigeration",
        ],
        "pulse_pointers": [
            {"label": "Ice plant equipment", "href": "/equipment"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Daily ice plant rounds (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "tsbc-refrigeration-design-registration",
        "title": "TSBC information bulletin — refrigeration plant design registration",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Information Bulletin IB-DA 2020-01 — Design Registration of Refrigeration Plants and Systems",
        "official_source_name": (
            "Technical Safety BC — Information Bulletin: Design Registration of Refrigeration "
            "Plants and Systems (IB-DA 2020-01)"
        ),
        "official_source_url": TSBC_IB_DA_2020_01,
        "extra_sources": [
            TSBC_REFRIGERATION_DESIGN_REG,
            PEBPVR_BC_LAWS,
            TSBC_REFRIGERATION_HOME,
            TSBC_D_BP_2025_02,
        ],
        "applicability": (
            "New, existing, or retrofit refrigeration system designs that must be registered before "
            "installation, or when a modification changes the registered design. Arena ice-plant "
            "alterations (chiller, piping, relief, secondary coolant) should be checked against this "
            "bulletin and PEBPVRSR s. 84 — not decided in Pulse."
        ),
        "summary": (
            "TSBC’s public information bulletin (IB-DA 2020-01, revision dated 31 December 2024) "
            "explains that refrigeration system designs are registered under the Safety Standards "
            "Act, PEBPVRSR (including s. 84), and the adopted CSA B52 / B51 codes. Public points "
            "— confirm on the bulletin and TSBC’s refrigeration design-registration page; Pulse "
            "does not paste CSA drawing lists:\n"
            "• Designs are submitted to the Provincial Safety Manager, Engineering before "
            "installation. Packages must be authenticated by a professional engineer (engineer of "
            "record).\n"
            "• Secondary-coolant designs on heat exchangers and associated piping must include "
            "considerations on preventing over-pressurization (thermal expansion of trapped "
            "secondary coolant, or refrigerant leaks into the secondary coolant).\n"
            "• A P&ID of the plant, including the secondary coolant system, is among the materials "
            "TSBC lists on the design-registration page.\n"
            "Use the bulletin with a licensed designer for any Civic Arena plant change. This card "
            "is not a permit application."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "design registration",
            "ib-da 2020-01",
            "refrigeration plant",
            "secondary coolant",
            "overpressure",
            "professional engineer",
            "section 84",
            "s.84",
            "ice plant",
            "ammonia",
            "tsbc",
            "permit",
        ],
        "pulse_pointers": [
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Planning hub", "href": "/recreation/planning"},
            {"label": "Ice plant equipment", "href": "/equipment"},
        ],
    },
    {
        "key": "worksafebc-chlorine-toxic-process-gas",
        "title": "WorkSafeBC — chlorine as a toxic process gas (pools as workplaces)",
        "topic_category": "OH&S",
        "classification": "Regulator guidance",
        "authority": "WorkSafeBC",
        "regulation_name": "OHS Regulation ss. 6.116–6.132 (toxic process gases) and s. 5.54 (exposure control plan)",
        "official_source_name": "WorkSafeBC — chlorine exposure during storage or use (risk advisory)",
        "official_source_url": WSBC_CHLORINE_ADVISORY,
        "extra_sources": [
            WSBC_CHLORINE_SWP,
            WSBC_OHS_PART6,
            WSBC_OHS_G6,
            BCRPA_POOLSAFE_RESOURCES,
        ],
        "applicability": (
            "Workplaces that transport, store, or use chlorine, including public swimming pools "
            "named on the advisory. Confirm whether Vernon Aquatic Centre uses chlorine gas, "
            "hypochlorite, or another disinfectant — the toxic-process-gas sections apply to "
            "chlorine as a process gas; hypochlorite handling still sits under WHMIS / Part 5. "
            "This is workplace OH&S, not Interior Health pool-water chemistry."
        ),
        "summary": (
            "WorkSafeBC’s public chlorine risk advisory warns that high chlorine-gas exposure can "
            "cause immediate eye and lung injury or death. Public swimming pools are listed among "
            "workplaces that may use chlorine as a disinfectant. Public points — confirm on the "
            "advisory and the searchable regulation:\n"
            "• OHS Regulation ss. 6.116–6.132 cover toxic process gases (one of which is chlorine): "
            "risk assessment, exposure control plan, procedures, education, enclosure, testing, "
            "ventilation, emergency ventilation, shut-down device, PPE, monitors/alarms, and "
            "maintenance.\n"
            "• Employers must implement an exposure control plan meeting s. 5.54.\n"
            "• Guidelines G6.116–G6.127 sit beside those sections.\n"
            "• The advisory also notes BC Fire Code and Part 3 BC Building Code duties for "
            "storage/handling of flammable substances, and points to WorkSafeBC’s Chlorine safe "
            "work practices book and the BCRPA PoolSafeBC Best Practices Guide (industry best "
            "practice — not law).\n"
            "Pulse does not reproduce those books. Record actual operator / chlorine-handling "
            "tickets in certifications; keep SDS and the site exposure-control plan as the "
            "operational sources of truth."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "chlorine",
            "chlorine exposure",
            "toxic process gas",
            "pool",
            "aquatic",
            "exposure control",
            "section 5.54",
            "6.116",
            "worksafebc",
        ],
        "pulse_pointers": [
            {"label": "Chemical spill — internal response", "match_title": "Chemical spill — internal response", "match_kind": "procedure"},
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Pool equipment / chemical controller", "href": "/equipment"},
            {"label": "Pool contractors", "href": "/recreation/contractors"},
            {"label": "Training / WHMIS tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
        ],
    },
    {
        "key": "worksafebc-chloramines-indoor-pools",
        "title": "WorkSafeBC — indoor pool air / chloramines",
        "topic_category": "OH&S",
        "classification": "Regulator guidance",
        "authority": "WorkSafeBC",
        "regulation_name": "WorkSafeBC guidance on airborne chloramines (no B.C. occupational exposure limit)",
        "official_source_name": "WorkSafeBC Magazine — controlling chemical exposure in pools (Summer 2025)",
        "official_source_url": WSBC_CHLORAMINES_ARTICLE,
        "extra_sources": [
            WSBC_CHLORAMINES,
            WSBC_CHLORAMINES_SWP,
            POOL_REG_BC_LAWS,
        ],
        "applicability": (
            "Indoor aquatic workplaces (Vernon Aquatic Centre deck, mechanical rooms, and similar). "
            "This is worker air quality under WorkSafeBC. Combined chlorine in the water remains a "
            "Pool Regulation / Interior Health topic — do not treat this card as the public-health "
            "limit table."
        ),
        "summary": (
            "WorkSafeBC’s Summer 2025 magazine article (and the chloramines hazards page) treat "
            "airborne chloramines (“combined chlorine”) as an indoor-pool workplace hazard. Public "
            "points — confirm on those pages; this is not a legal determination:\n"
            "• Chloramines form when chlorine or hypochlorite reacts with nitrogen (sweat, body "
            "oils, cosmetics, dirt, urine, some cleaners) and off-gas from the water. Effects "
            "described include eye/skin and respiratory irritation; long-term worker exposure may "
            "contribute to occupational asthma.\n"
            "• There is no occupational exposure limit in B.C. for chloramines in air. WorkSafeBC "
            "recommends keeping airborne chloramines in indoor aquatic facilities below 0.35 mg/m³.\n"
            "• Production rises with hotter water, bubbling/splashing features, and higher occupancy. "
            "Controls described are both reducing production in the water and removing chloramines "
            "from the air (ventilation / extraction). The article also discusses water testing, "
            "HVAC, UV, and a written chloramine exposure-control plan as employer practice.\n"
            "• Combined chlorine in pool water is still a public-health test in Pool Regulation "
            "s. 10. Use that regulation for water limits; use this card for workplace air.\n"
            "Pulse water-quality PMs do not measure airborne chloramines. Do not treat a Pulse "
            "checklist as an air-monitoring program."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "chloramine",
            "chloramines",
            "combined chlorine",
            "indoor pool",
            "air quality",
            "0.35",
            "ventilation",
            "worksafebc",
            "pool",
        ],
        "pulse_pointers": [
            {"label": "Daily water quality checks (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Pool HVAC / equipment", "href": "/equipment"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Pool emergency — internal response", "match_title": "Drowning / pool emergency — internal response", "match_kind": "knowledge"},
        ],
    },
    {
        "key": "bc-guidelines-pool-design-operations",
        "title": "B.C. Guidelines for Pool Design and Pool Operations (Ministry of Health)",
        "topic_category": "Interior Health / Pools",
        "classification": "Regulator guidance",
        "authority": "B.C. Ministry of Health — Health Protection Branch",
        "regulation_name": "B.C. Guidelines for Pool Design / Pool Operations (interpret the Pool Regulation; not a substitute for it)",
        "official_source_name": "Province of B.C. — recreational water quality (pool design and operations guidelines)",
        "official_source_url": MOH_REC_WATER,
        "extra_sources": [
            MOH_POOL_DESIGN_PDF,
            MOH_POOL_OPERATIONS_PDF,
            MOH_POOL_SAFETY_PLAN_PDF,
            POOL_REG_BC_LAWS,
            IH_REC_WATER_PERMITS,
        ],
        "applicability": (
            "Designers, operators, and Interior Health reviewers of public/commercial pools and "
            "hot tubs. The Ministry states these guidelines help interpret the Pool Regulation and "
            "represent generally accepted minimum standards of safe practice — legislation prevails "
            "if there is a discrepancy. Not ice arenas."
        ),
        "summary": (
            "The Ministry of Health publishes B.C. Guidelines for Pool Design and B.C. Guidelines "
            "for Pool Operations on the recreational water quality page (April 2025 PDFs at the "
            "time this card was reviewed). Interior Health’s permits page also points operators "
            "there. Public points — confirm on the Ministry page; Pulse does not reproduce the "
            "guidelines:\n"
            "• Design guideline: helps interpret the Pool Regulation for construction; IH Public "
            "Health Engineers consider it when issuing construction permits. “Must” in the "
            "guideline denotes a requirement of the Pool Regulation or another applicable code; "
            "“should” is generally accepted practice.\n"
            "• Operations guideline: operator permit, pool safety plan, water quality, and "
            "qualified maintenance themes. It is not a substitute for a pool-operator course "
            "(IH lists BCRPA, RFABC, and other courses).\n"
            "• Pool safety plan: the Ministry also hosts a fillable Guide and Pool Safety Plan "
            "and a basic plan template. The regulation still requires the operator’s own written "
            "plan (s. 13).\n"
            "Use the Pool Regulation for binding text and Interior Health for the Vernon permit "
            "path. This card is not a design review and not an operator certificate."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "pool design",
            "pool operations",
            "pool operators",
            "ministry of health",
            "guidelines",
            "pool safety plan",
            "recreational water",
            "interior health",
        ],
        "pulse_pointers": [
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Seasonal checklists", "href": "/recreation/checklists"},
            {"label": "Daily water quality checks", "href": "/dashboard/pm-workspace"},
            {"label": "Lifeguard / operator tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
        ],
    },
    {
        "key": "bcrpa-poolsafebc-best-practices",
        "title": "PoolSafeBC Best Practices Guide (BCRPA)",
        "topic_category": "Chemicals",
        "classification": "Best practice",
        "authority": "BC Recreation and Parks Association",
        "regulation_name": "PoolSafeBC Best Practices Guide (industry best practice — not law)",
        "official_source_name": "BCRPA — PoolSafeBC course resources (Best Practices Guide)",
        "official_source_url": BCRPA_POOLSAFE_RESOURCES,
        "extra_sources": [
            BCRPA_POOLSAFE_PDF,
            WSBC_CHLORINE_ADVISORY,
        ],
        "applicability": (
            "Aquatic centre staff and employers looking for industry practice on pool workplace "
            "hazards (chemical safety, chlorine rooms, WHMIS, emergency prep). WorkSafeBC’s "
            "chlorine risk advisory lists this guide as a related resource. It is not a statute "
            "and not an Interior Health operating permit."
        ),
        "summary": (
            "PoolSafeBC is BCRPA training for aquatic staff to recognize, evaluate, and control "
            "hazards in a B.C. pool setting. The public resources page links a Best Practices "
            "Guide covering rights and responsibilities, hazards, chemical safety, and emergency "
            "preparation, including templates for risk assessments and exposure-control plans. "
            "Public points — confirm on the BCRPA page:\n"
            "• Classification in Pulse is Best practice, not Law/Regulation. The Workers "
            "Compensation Act / OHS Regulation remain the legal workplace rules; the Pool "
            "Regulation remains the public-health pool rules.\n"
            "• WorkSafeBC’s chlorine storage/use advisory points employers to this guide alongside "
            "WorkSafeBC’s own Chlorine safe work practices book.\n"
            "• Course outline themes (chemical safety section) include toxic process gases, "
            "chlorine-room entry/alarms, hypochlorites, bromine, treatment and testing chemicals, "
            "WHMIS, and PPE/respirators — use the current BCRPA materials, not this summary, for "
            "course content.\n"
            "Pulse does not reproduce the guide. Record actual PoolSafeBC / operator tickets in "
            "certifications."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "poolsafebc",
            "bcrpa",
            "best practice",
            "pool chemical",
            "chlorine",
            "whmis",
            "exposure control",
            "aquatic",
        ],
        "pulse_pointers": [
            {"label": "Training / WHMIS / operator tickets", "href": "/training/compliance/workers?panel=certifications"},
            {"label": "Aquatic facility profile", "href": "/recreation/facilities"},
            {"label": "Chemical spill — internal response", "match_title": "Chemical spill — internal response", "match_kind": "procedure"},
            {"label": "Pool contractors", "href": "/recreation/contractors"},
            {"label": "Work requests", "href": "/dashboard/maintenance"},
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
            "chief engineer definition",
            "chief engineer duties",
            "section 68",
        ),
    ),
    (
        "ohs",
        (
            "oh&s",
            "ohs",
            "occupational health",
            "worksafebc",
            "worksafe",
            "workers compensation",
            "chloramine",
            "chloramines",
            "toxic process gas",
            "worksafebc recreation",
        ),
    ),
    (
        "building_code",
        ("building code", "bc building code", "bcbc", "plumbing code", "assembly occupancy", "building accessibility"),
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
            "pool permit",
            "pool construction permit",
            "pool operating permit",
            "pool safety plan",
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
            "secondary coolant",
            "design registration",
            "ice plant requirements",
        ),
    ),
    ("fire", ("fire code", "fire safety plan", "vernon fire")),
    ("electrical", ("electrical safety", "electrical code", "electrical permit")),
    ("playground", ("playground", "csa z614", "playspace")),
    ("chemicals", ("whmis", "chemical storage", "chemical handling", "sds", "chlorine", "pool chemical")),
    ("emergency_ammonia", ("ammonia release", "ammonia emergency", "ammonia response")),
)

INTENT_TO_CARD_KEYS: dict[str, tuple[str, ...]] = {
    "chief_engineer": (
        "pebpvrsr-chief-engineer-definition-duties",
        "chief-engineer-plant-responsibility",
        "tsbc-refrigeration-operator-certificate",
        "tsbc-ice-facility-operator-certificate",
        "pebpvrsr-refrigeration-in-charge-classification",
        "tsbc-plant-supervision-vicinity",
        "tsbc-ammonia-public-occupancy",
        "safety-standards-act-overview",
    ),
    "ohs": (
        "worksafebc-ohs-how-to-look-up",
        "worksafebc-ammonia-refrigeration",
        "worksafebc-chlorine-toxic-process-gas",
        "worksafebc-chloramines-indoor-pools",
        "worksafebc-whmis-chemicals",
    ),
    "building_code": ("bc-building-code-how-it-applies",),
    "interior_health_pools": (
        "interior-health-recreational-water",
        "bc-pool-regulation",
        "pool-chemistry-public-health-angle",
        "bc-guidelines-pool-design-operations",
        "bcrpa-poolsafebc-best-practices",
    ),
    "refrigeration_plant": (
        "tsbc-ammonia-safety-awareness",
        "pebpvrsr-refrigeration-in-charge-classification",
        "pebpvrsr-chief-engineer-definition-duties",
        "tsbc-secondary-coolant-overpressure",
        "tsbc-refrigeration-design-registration",
        "chief-engineer-plant-responsibility",
        "tsbc-plant-supervision-vicinity",
        "tsbc-ammonia-public-occupancy",
        "tsbc-general-supervision-risk-assessed",
        "tsbc-refrigeration-operator-certificate",
        "tsbc-ice-facility-operator-certificate",
        "worksafebc-ammonia-refrigeration",
        "safety-standards-act-overview",
    ),
    "fire": ("bc-fire-code-and-vernon-fire-bylaw",),
    "electrical": ("tsbc-electrical-safety",),
    "playground": ("playground-csa-z614",),
    "chemicals": (
        "worksafebc-whmis-chemicals",
        "worksafebc-chlorine-toxic-process-gas",
        "worksafebc-chloramines-indoor-pools",
        "pool-chemistry-public-health-angle",
        "bcrpa-poolsafebc-best-practices",
    ),
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
