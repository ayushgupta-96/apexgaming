-- ====================================================================
-- V2: Wallet, Double-Entry Ledger, and Financial Transactions
-- ====================================================================

CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    deposit_balance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    winnings_balance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    bonus_balance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    locked_balance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_balances_non_negative CHECK (
        deposit_balance >= 0 AND
        winnings_balance >= 0 AND
        bonus_balance >= 0 AND
        locked_balance >= 0
    )
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

CREATE TABLE IF NOT EXISTS ledger_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_code VARCHAR(100) NOT NULL UNIQUE,
    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    balance NUMERIC(16, 4) NOT NULL DEFAULT 0.0000,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_uuid VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id),
    transaction_type VARCHAR(50) NOT NULL, -- DEPOSIT, WITHDRAWAL, BET_PLACED, GAME_WIN, BET_REFUND, HOUSE_COMMISSION, ADJUSTMENT
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- PENDING, COMPLETED, FAILED, REVERSED
    total_amount NUMERIC(14, 4) NOT NULL,
    reference_type VARCHAR(50) NOT NULL, -- DEPOSIT_REQUEST, WITHDRAWAL_REQUEST, LUDO_MATCH, AVIATOR_ROUND, COLOUR_ROUND, MANUAL_ADJUSTMENT
    reference_id VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tx_uuid ON transactions(transaction_uuid);
CREATE INDEX idx_tx_user ON transactions(user_id);
CREATE INDEX idx_tx_ref ON transactions(reference_type, reference_id);
CREATE INDEX idx_tx_idempotency ON transactions(idempotency_key);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_code VARCHAR(100) NOT NULL REFERENCES ledger_accounts(account_code),
    entry_type VARCHAR(10) NOT NULL, -- DEBIT, CREDIT
    amount NUMERIC(14, 4) NOT NULL,
    sub_bucket VARCHAR(30), -- DEPOSIT, WINNINGS, BONUS, LOCKED, SYSTEM
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_entry_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_ledger_entries_tx ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_code);
CREATE INDEX idx_ledger_entries_created ON ledger_entries(created_at);
