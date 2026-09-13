-- ====================================================================
-- V3: Manual Payment Verification via WhatsApp
-- ====================================================================

CREATE TABLE IF NOT EXISTS deposit_requests (
    id BIGSERIAL PRIMARY KEY,
    reference_code VARCHAR(100) NOT NULL UNIQUE, -- e.g. DEP-{userId}-{timestamp}
    user_id BIGINT NOT NULL REFERENCES users(id),
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, UNDER_REVIEW, APPROVED, REJECTED, EXPIRED
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI', -- UPI, IMPS, NEFT, RTGS
    utr_number VARCHAR(100),
    proof_image_url VARCHAR(500),
    admin_notes TEXT,
    processed_by BIGINT REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposit_ref ON deposit_requests(reference_code);
CREATE INDEX idx_deposit_user ON deposit_requests(user_id);
CREATE INDEX idx_deposit_status ON deposit_requests(status);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id BIGSERIAL PRIMARY KEY,
    reference_code VARCHAR(100) NOT NULL UNIQUE, -- e.g. WDR-{userId}-{timestamp}
    user_id BIGINT NOT NULL REFERENCES users(id),
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION', -- PENDING_VERIFICATION, UNDER_REVIEW, APPROVED, PAID, REJECTED
    destination_type VARCHAR(20) NOT NULL, -- UPI, BANK_ACCOUNT
    account_holder_name VARCHAR(100) NOT NULL,
    account_number_or_vpa VARCHAR(100) NOT NULL,
    ifsc_code VARCHAR(30),
    bank_name VARCHAR(100),
    payout_utr VARCHAR(100),
    proof_image_url VARCHAR(500),
    rejection_reason TEXT,
    processed_by BIGINT REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawal_ref ON withdrawal_requests(reference_code);
CREATE INDEX idx_withdrawal_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests(status);

CREATE TABLE IF NOT EXISTS payment_proofs (
    id BIGSERIAL PRIMARY KEY,
    reference_type VARCHAR(30) NOT NULL, -- DEPOSIT, WITHDRAWAL
    reference_id BIGINT NOT NULL,
    uploaded_by BIGINT REFERENCES users(id),
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    extracted_utr VARCHAR(100),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED', -- UNVERIFIED, MATCHED, INVALID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id),
    sender_phone VARCHAR(30) NOT NULL,
    related_reference_code VARCHAR(100), -- Can match DEP-... or WDR-...
    ticket_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_VERIFICATION', -- PAYMENT_VERIFICATION, WITHDRAWAL_INQUIRY, GENERAL_SUPPORT
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    assigned_admin_id BIGINT REFERENCES users(id),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_whatsapp_tickets_phone ON whatsapp_tickets(sender_phone);
CREATE INDEX idx_whatsapp_tickets_ref ON whatsapp_tickets(related_reference_code);
CREATE INDEX idx_whatsapp_tickets_status ON whatsapp_tickets(status);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES whatsapp_tickets(id) ON DELETE CASCADE,
    wa_message_id VARCHAR(100) UNIQUE,
    sender_type VARCHAR(20) NOT NULL, -- USER, ADMIN, SYSTEM
    sender_phone VARCHAR(30) NOT NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    message_body TEXT,
    media_url VARCHAR(500),
    media_type VARCHAR(50), -- IMAGE, DOCUMENT, AUDIO
    delivery_status VARCHAR(30) DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wa_messages_ticket ON whatsapp_messages(ticket_id);
CREATE INDEX idx_wa_messages_created ON whatsapp_messages(created_at);
