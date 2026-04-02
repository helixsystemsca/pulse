-- Reference DDL for automation engine + device hub (PostgreSQL).
-- Prefer `alembic upgrade head`; this mirrors revisions 0013–0017.

CREATE TABLE IF NOT EXISTS automation_events (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
    event_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_automation_events_event_type ON automation_events (event_type);
CREATE INDEX IF NOT EXISTS ix_automation_events_created_at ON automation_events (created_at);
CREATE INDEX IF NOT EXISTS ix_automation_events_company_id ON automation_events (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_events_idempotency_key ON automation_events (idempotency_key);
-- CREATE UNIQUE INDEX uq_automation_events_company_idempotency ON automation_events (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    source_module VARCHAR(32) NOT NULL DEFAULT 'ingest',
    message TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_automation_logs_company_id ON automation_logs (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_logs_type ON automation_logs (type);
CREATE INDEX IF NOT EXISTS ix_automation_logs_severity ON automation_logs (severity);
CREATE INDEX IF NOT EXISTS ix_automation_logs_source_module ON automation_logs (source_module);
CREATE INDEX IF NOT EXISTS ix_automation_logs_created_at ON automation_logs (created_at);

CREATE TABLE IF NOT EXISTS automation_feature_configs (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    feature_name VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_automation_feature_config_company_name UNIQUE (company_id, feature_name)
);
CREATE INDEX IF NOT EXISTS ix_automation_feature_configs_company_id ON automation_feature_configs (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_feature_configs_feature_name ON automation_feature_configs (feature_name);

CREATE TABLE IF NOT EXISTS automation_state_tracking (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    entity_key VARCHAR(512) NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_automation_state_company_entity UNIQUE (company_id, entity_key)
);
CREATE INDEX IF NOT EXISTS ix_automation_state_tracking_company_id ON automation_state_tracking (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_state_tracking_entity_key ON automation_state_tracking (entity_key);

CREATE TABLE IF NOT EXISTS automation_notifications (
    id UUID PRIMARY KEY NOT NULL,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_automation_notifications_company_id ON automation_notifications (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_notifications_user_id ON automation_notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_automation_notifications_type ON automation_notifications (type);
CREATE INDEX IF NOT EXISTS ix_automation_notifications_status ON automation_notifications (status);
CREATE INDEX IF NOT EXISTS ix_automation_notifications_created_at ON automation_notifications (created_at);

CREATE TABLE IF NOT EXISTS automation_gateways (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ,
    zone_id UUID REFERENCES zones (id) ON DELETE SET NULL,
    CONSTRAINT uq_automation_gateway_company_identifier UNIQUE (company_id, identifier)
);
CREATE INDEX IF NOT EXISTS ix_automation_gateways_company_id ON automation_gateways (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_gateways_identifier ON automation_gateways (identifier);
CREATE INDEX IF NOT EXISTS ix_automation_gateways_status ON automation_gateways (status);
CREATE INDEX IF NOT EXISTS ix_automation_gateways_zone_id ON automation_gateways (zone_id);

CREATE TABLE IF NOT EXISTS automation_ble_devices (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mac_address VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    assigned_worker_id UUID REFERENCES users (id) ON DELETE SET NULL,
    assigned_equipment_id UUID REFERENCES tools (id) ON DELETE SET NULL,
    CONSTRAINT uq_automation_ble_company_mac UNIQUE (company_id, mac_address)
);
CREATE INDEX IF NOT EXISTS ix_automation_ble_devices_company_id ON automation_ble_devices (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_ble_devices_mac_address ON automation_ble_devices (mac_address);
CREATE INDEX IF NOT EXISTS ix_automation_ble_devices_type ON automation_ble_devices (type);
CREATE INDEX IF NOT EXISTS ix_automation_ble_devices_assigned_worker_id ON automation_ble_devices (assigned_worker_id);
CREATE INDEX IF NOT EXISTS ix_automation_ble_devices_assigned_equipment_id ON automation_ble_devices (assigned_equipment_id);

CREATE TABLE IF NOT EXISTS automation_unknown_devices (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    mac_address VARCHAR(32) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    seen_count INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_automation_unknown_company_mac UNIQUE (company_id, mac_address)
);
CREATE INDEX IF NOT EXISTS ix_automation_unknown_devices_company_id ON automation_unknown_devices (company_id);
CREATE INDEX IF NOT EXISTS ix_automation_unknown_devices_mac_address ON automation_unknown_devices (mac_address);

-- zones.description added in 0014 (omitted here if zones already exists without it — use Alembic).
