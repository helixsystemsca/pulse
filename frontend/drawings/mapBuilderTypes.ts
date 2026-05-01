export type PrimaryMode = "select" | "add_asset" | "connect" | "add_zone" | "annotate";

/** Geometry input while placing infrastructure assets (semantic, not generic shapes). */
export type AssetDrawShape = "rectangle" | "ellipse" | "polygon";

/** Connect: pick two assets (existing) vs draw a segment whose endpoints snap to assets. */
export type ConnectFlow = "pick" | "draw";

/** Annotate: decorative / non-graph blueprint overlays only. */
export type AnnotateKind = "symbol" | "sketch";
