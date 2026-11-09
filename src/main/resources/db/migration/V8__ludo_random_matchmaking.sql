-- V7: Distinguish public matchmaking rooms from invite-only rooms and serialize queue creation.
ALTER TABLE ludo_matches
    ADD COLUMN IF NOT EXISTS is_matchmaking BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ludo_matchmaking_waiting
    ON ludo_matches (stake_amount, max_players, created_at)
    WHERE is_matchmaking = TRUE AND status = 'WAITING';

-- One transaction-scoped row lock per stake/player-count queue prevents
-- simultaneous first entrants from creating isolated waiting rooms.
CREATE TABLE IF NOT EXISTS ludo_matchmaking_locks (
    lock_key VARCHAR(80) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
