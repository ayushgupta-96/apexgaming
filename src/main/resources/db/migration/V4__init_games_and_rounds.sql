-- ====================================================================
-- V4: Games (Ludo, Aviator, Colour Prediction), Rounds, and Bets
-- ====================================================================

-- Generic Game Rounds & Provably Fair Commitments
CREATE TABLE IF NOT EXISTS game_rounds (
    id BIGSERIAL PRIMARY KEY,
    game_type VARCHAR(50) NOT NULL, -- LUDO, AVIATOR, COLOUR_PREDICTION
    round_uuid VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED', -- CREATED, BETTING, RUNNING, COMPLETED, CANCELLED
    server_seed VARCHAR(128) NOT NULL,
    server_seed_hash VARCHAR(128) NOT NULL,
    client_seed VARCHAR(128),
    nonce BIGINT NOT NULL DEFAULT 1,
    result_data JSONB,
    total_bets_count INT NOT NULL DEFAULT 0,
    total_bet_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    total_payout_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    house_commission_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_rounds_type ON game_rounds(game_type);
CREATE INDEX idx_game_rounds_status ON game_rounds(status);
CREATE INDEX idx_game_rounds_uuid ON game_rounds(round_uuid);

-- Generic Bets
CREATE TABLE IF NOT EXISTS bets (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    bet_uuid VARCHAR(64) NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    selection VARCHAR(50), -- Color name, number, or game-specific token
    multiplier NUMERIC(8, 2), -- Crash multiplier cashed out, or payout odds
    payout_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(30) NOT NULL DEFAULT 'PLACED', -- PLACED, WON, LOST, CANCELLED, REFUNDED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_bets_round ON bets(round_id);
CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);

-- Ludo Specific Tables
CREATE TABLE IF NOT EXISTS ludo_matches (
    id BIGSERIAL PRIMARY KEY,
    match_uuid VARCHAR(64) NOT NULL UNIQUE,
    stake_amount NUMERIC(12, 2) NOT NULL,
    max_players INT NOT NULL DEFAULT 4,
    current_players INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'WAITING', -- WAITING, IN_PROGRESS, COMPLETED, ABANDONED
    current_turn_color VARCHAR(20), -- RED, GREEN, YELLOW, BLUE
    current_turn_user_id BIGINT REFERENCES users(id),
    turn_expires_at TIMESTAMP WITH TIME ZONE,
    board_state JSONB, -- JSON representation of tokens positions
    winner_user_id BIGINT REFERENCES users(id),
    total_pot NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    commission_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    winner_payout NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ludo_players (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES ludo_matches(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    color VARCHAR(20) NOT NULL, -- RED, GREEN, YELLOW, BLUE
    seat_index INT NOT NULL,
    is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    is_connected BOOLEAN NOT NULL DEFAULT TRUE,
    tokens_finished INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_match_color UNIQUE (match_id, color),
    CONSTRAINT uq_match_seat UNIQUE (match_id, seat_index)
);

CREATE TABLE IF NOT EXISTS ludo_moves (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES ludo_matches(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES ludo_players(id),
    dice_roll INT NOT NULL,
    token_index INT,
    from_position INT,
    to_position INT,
    captured_player_color VARCHAR(20),
    move_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Aviator Specific Tables
CREATE TABLE IF NOT EXISTS aviator_rounds (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL UNIQUE REFERENCES game_rounds(id) ON DELETE CASCADE,
    crash_multiplier NUMERIC(8, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'WAITING', -- WAITING, BETTING, FLYING, CRASHED
    flight_start_time TIMESTAMP WITH TIME ZONE,
    crashed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS aviator_bets (
    id BIGSERIAL PRIMARY KEY,
    bet_id BIGINT NOT NULL UNIQUE REFERENCES bets(id) ON DELETE CASCADE,
    auto_cashout_multiplier NUMERIC(8, 2),
    cashed_out_multiplier NUMERIC(8, 2),
    is_cashed_out BOOLEAN NOT NULL DEFAULT FALSE,
    cashed_out_at TIMESTAMP WITH TIME ZONE
);

-- Colour Prediction Specific Tables
CREATE TABLE IF NOT EXISTS colour_rounds (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL UNIQUE REFERENCES game_rounds(id) ON DELETE CASCADE,
    winning_number INT, -- 0 to 9
    winning_color VARCHAR(20), -- GREEN, RED, VIOLET, GREEN_VIOLET, RED_VIOLET
    price_indicator NUMERIC(10, 2),
    betting_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS colour_bets (
    id BIGSERIAL PRIMARY KEY,
    bet_id BIGINT NOT NULL UNIQUE REFERENCES bets(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL, -- COLOR, NUMBER
    target_value VARCHAR(20) NOT NULL -- RED, GREEN, VIOLET, or '0'-'9'
);
