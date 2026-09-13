-- ====================================================================
-- V5: Compliance, Anti-Money Laundering (AML), Fraud, and Audit Logs
-- ====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users(id),
    actor_username VARCHAR(50) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g. APPROVE_DEPOSIT, APPROVE_WITHDRAWAL, BAN_USER, OVERRIDE_RESULT
    target_entity VARCHAR(50) NOT NULL, -- USER, DEPOSIT, WITHDRAWAL, GAME_ROUND, WALLET
    target_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    old_state JSONB,
    new_state JSONB,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_target ON audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS fraud_flags (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) NOT NULL, -- MULTI_ACCOUNT, RAPID_DEPOSIT_BURST, NO_PLAY_WITHDRAWAL, SUSPICIOUS_IP, COLLUSION_SUSPECT
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by BIGINT REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_fraud_user ON fraud_flags(user_id);
CREATE INDEX idx_fraud_resolved ON fraud_flags(is_resolved);

CREATE TABLE IF NOT EXISTS aml_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- HIGH_SINGLE_TRANSACTION, HIGH_DAILY_VELOCITY, SUDDEN_ACTIVITY_SPIKE
    trigger_amount NUMERIC(14, 4),
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW', -- NEW, INVESTIGATING, DISMISSED, REPORTED_FIU
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_aml_user ON aml_alerts(user_id);
CREATE INDEX idx_aml_status ON aml_alerts(status);

CREATE TABLE IF NOT EXISTS blocked_jurisdictions (
    id BIGSERIAL PRIMARY KEY,
    country_code VARCHAR(10) NOT NULL DEFAULT 'IN',
    state_code VARCHAR(50) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_country_state UNIQUE(country_code, state_code)
);
