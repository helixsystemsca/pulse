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


# Catalog review date for URLs checked while authoring this starter set.
_REVIEWED = "2026-09-15"

REFERENCE_CARDS: tuple[ReferenceCard, ...] = (
    {
        "key": "chief-engineer-plant-responsibility",
        "title": "Chief engineer / plant operator responsibility overview",
        "topic_category": "Chief Engineer",
        "classification": "Law/Regulation",
        "authority": "Technical Safety BC",
        "regulation_name": "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation (B.C. Reg. 104/2004)",
        "official_source_name": "Technical Safety BC — temporary absence of Chief Engineer (points to the Regulation)",
        "official_source_url": "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/directive-temporary-absence-chief-engineer",
        "extra_sources": [
            "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/104_2004",
            "https://www.canlii.org/en/bc/laws/regu/bc-reg-104-2004/latest/bc-reg-104-2004.html",
        ],
        "applicability": "Arena ice plant / ammonia refrigeration and any other regulated boiler or refrigeration plant on City of Vernon recreation sites.",
        "summary": (
            "Technical Safety BC publishes public directives that explain how the provincial "
            "Power Engineers, Boiler, Pressure Vessel and Refrigeration Safety Regulation talks "
            "about a chief engineer (the power engineer designated by the owner as responsible "
            "for operation and maintenance, including that regulated work is done by qualified "
            "people) and a person in charge of a shift. Refrigeration plants have their own "
            "qualification rules in that regulation (refrigeration operator or fourth-class or "
            "higher power engineer in charge). Read the current regulation and TSBC notices for "
            "the actual wording, plant classification, and attendance rules. Pulse does not "
            "decide who is legally the chief engineer at Vernon."
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
            "tsbc",
            "technical safety bc",
        ],
        "pulse_pointers": [
            {"label": "Ice plant PMs", "href": "/equipment"},
            {"label": "Refrigeration contractor pack", "href": "/recreation/contractors"},
            {"label": "Refrigeration / ice plant tickets", "href": "/training/compliance/workers?panel=certifications"},
        ],
    },
    {
        "key": "tsbc-plant-supervision-vicinity",
        "title": "Plant supervision and “immediate vicinity” (TSBC)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Directive — Plant Supervision Requirements: Definition of Immediate Vicinity",
        "official_source_name": "Technical Safety BC — plant supervision / immediate vicinity directive",
        "official_source_url": "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/directive-plant-supervision-requirements-definition-of-immediate-vicinity",
        "extra_sources": [
            "https://www.technicalsafetybc.ca/technologies/boilers-pressure-vessels/operating-permits/special-status-plants-general-supervision-risk-assessed",
        ],
        "applicability": "Regulated boiler and refrigeration plants, including arena ice plants. Special-status (general supervision / risk assessed) plants have different attendance models — confirm the site’s operating permit.",
        "summary": (
            "TSBC’s public directive explains that while a plant is in operation, the person in "
            "charge is expected to be in the machinery room or in the “immediate vicinity within "
            "the plant premises,” with enough control to respond to upsets. The notice says a "
            "fixed distance is not prescribed for every plant. It also describes the owner and "
            "chief engineer role in written procedures if the person in charge may leave the "
            "machinery room. This card is a pointer to that guidance — not a site-specific "
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
            "refrigeration plant requirements",
        ],
        "pulse_pointers": [
            {"label": "Daily ice plant rounds (internal PM)", "href": "/dashboard/pm-workspace"},
            {"label": "Arena facility profile", "href": "/recreation/facilities"},
        ],
    },
    {
        "key": "tsbc-ammonia-public-occupancy",
        "title": "Ammonia refrigeration in public occupancies (ice rinks)",
        "topic_category": "Refrigeration / TSBC",
        "classification": "Regulator guidance",
        "authority": "Technical Safety BC",
        "regulation_name": "TSBC Safety Order — Operation of ammonia refrigeration plants in public occupancies",
        "official_source_name": "Technical Safety BC — ammonia plants in public occupancies (ice / curling rinks)",
        "official_source_url": "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/safety-order-operation-ammonia-refrigeration-plants-public-occupancies",
        "extra_sources": [
            "https://www.technicalsafetybc.ca/technologies/refrigeration/installation-permits",
        ],
        "applicability": "Ammonia refrigeration plants in public assembly occupancies such as ice rinks. Confirm whether the Civic Arena plant size, refrigerant, and supervision status put it in scope of this order.",
        "summary": (
            "TSBC has a public safety order aimed at ammonia refrigeration plants in public "
            "assembly occupancies (including ice rinks). It addresses operation by appropriately "
            "qualified people under the Power Engineers regulation. Read the current order for "
            "capacity thresholds and supervision status. Installation / alteration of regulated "
            "refrigeration systems generally needs a TSBC installation permit unless an exemption "
            "applies — use TSBC’s refrigeration permit pages, not this summary, for permit rules."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ammonia",
            "ice rink",
            "public occupancy",
            "refrigeration plant",
            "safety order",
            "arena",
        ],
        "pulse_pointers": [
            {
                "label": "Ammonia release — internal response",
                "match_title": "Ammonia release — internal response",
                "match_kind": "knowledge",
            },
            {"label": "Emergency Response hub", "href": "/recreation/emergency"},
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
        ],
        "applicability": "Workplaces that use ammonia as a refrigerant, including ice rinks and similar recreation plants. Worker OH&S duties sit with the employer under the Workers Compensation Act / OHS Regulation — separate from TSBC plant qualification.",
        "summary": (
            "WorkSafeBC publishes a public guide for workplaces that use ammonia as a "
            "refrigerant (ice rinks are listed among typical sites). The guide points employers "
            "to the Occupational Health and Safety Regulation, including chemical / toxic process "
            "gas themes (risk assessment, exposure control, emergency planning). It is guidance "
            "that cites legal requirements — read the current OHS Regulation for the binding "
            "text. This Pulse card does not reproduce the guide or the regulation."
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
            "https://www.technicalsafetybc.ca/regulatory-resources/regulatory-notices/safety-order-operation-ammonia-refrigeration-plants-public-occupancies",
        ],
        "applicability": "Vernon Civic Arena ice plant / ammonia refrigeration room and adjacent public areas.",
        "summary": (
            "Life-safety response for an ammonia release is: follow the City emergency plan, "
            "evacuate, call 911, and do not re-enter without training and PPE. Pulse stores an "
            "internal response card and SOP so staff can find those steps quickly. Those Pulse "
            "records are labelled internal — they are not TSBC or WorkSafeBC citations. Use the "
            "linked regulator pages for employer emergency-planning themes, and keep the municipal "
            "plan as the operational source of truth."
        ),
        "verification_status": "Reviewed",
        "review_date": _REVIEWED,
        "keywords": [
            "ammonia release",
            "emergency",
            "ice plant",
            "evacuate",
            "911",
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
        ],
        "applicability": "Boilers, pressure vessels, refrigeration, electrical, gas, elevators, amusement rides, and related regulated equipment on recreation sites.",
        "summary": (
            "The Safety Standards Act is the provincial statute behind Technical Safety BC’s "
            "permits, qualifications, and assessments. A government overview lists the equipment "
            "classes it covers. TSBC is the delegated administrator for most of the province; a "
            "few municipalities handle electrical/gas permits. For ice plant and electrical work "
            "in Vernon, start with TSBC plus the specific regulation (power engineers / "
            "electrical). Read the Act on BC Laws for legal wording."
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
        ),
    ),
    ("fire", ("fire code", "fire safety plan", "vernon fire")),
    ("electrical", ("electrical safety", "electrical code", "electrical permit")),
    ("playground", ("playground", "csa z614", "playspace")),
    ("chemicals", ("whmis", "chemical storage", "chemical handling", "sds")),
    ("emergency_ammonia", ("ammonia release", "ammonia emergency", "ammonia response")),
)

INTENT_TO_CARD_KEYS: dict[str, tuple[str, ...]] = {
    "chief_engineer": ("chief-engineer-plant-responsibility", "tsbc-plant-supervision-vicinity", "safety-standards-act-overview"),
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
        "worksafebc-ammonia-refrigeration",
        "safety-standards-act-overview",
    ),
    "fire": ("bc-fire-code-and-vernon-fire-bylaw",),
    "electrical": ("tsbc-electrical-safety",),
    "playground": ("playground-csa-z614",),
    "chemicals": ("worksafebc-whmis-chemicals", "pool-chemistry-public-health-angle"),
    "emergency_ammonia": ("emergency-ammonia-internal-plus-regulators", "tsbc-ammonia-public-occupancy"),
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
