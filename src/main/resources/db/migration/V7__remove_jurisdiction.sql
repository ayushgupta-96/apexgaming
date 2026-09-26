-- ====================================================================
-- V7: Remove state / jurisdiction dependency
-- ====================================================================

-- Registration and user profiles are no longer jurisdiction-dependent.
ALTER TABLE user_profiles
DROP COLUMN IF EXISTS state;

-- The application no longer performs state/jurisdiction geo-blocking.
DROP TABLE IF EXISTS blocked_jurisdictions;