-- ====================================================================
-- V8: Remove KYC module and its database impact
-- ====================================================================

-- KYC records are no longer collected or reviewed by the platform.
DROP TABLE IF EXISTS kyc_documents;

-- User identity verification is no longer a KYC gate.
ALTER TABLE users
    DROP COLUMN IF EXISTS is_verified;
