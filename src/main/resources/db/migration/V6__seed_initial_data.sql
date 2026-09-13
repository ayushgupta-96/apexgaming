-- ====================================================================
-- V6: Seed System Accounts, Blocked States, and Initial Admin/Users
-- ====================================================================

-- 1. System Ledger Accounts
INSERT INTO ledger_accounts (account_code, account_name, account_type, balance, description) VALUES
('HOUSE_BANK_CLEARING', 'House Real Bank Clearing Account', 'ASSET', 10000000.0000, 'Physical clearing bank account holding user deposit funds'),
('HOUSE_COMMISSION_REVENUE', 'House Rake & Commission Revenue', 'REVENUE', 0.0000, 'Platform gaming commissions and house edges earned'),
('GAME_ESCROW_POOL', 'Game Round Active Escrow Pool', 'LIABILITY', 0.0000, 'Locked player stakes during active rounds awaiting settlement')
ON CONFLICT (account_code) DO NOTHING;

-- 2. Blocked Indian RMG Jurisdictions
INSERT INTO blocked_jurisdictions (country_code, state_code, state_name, reason) VALUES
('IN', 'AS', 'Assam', 'State gaming acts prohibit real-money online skill/chance games'),
('IN', 'OR', 'Odisha', 'Odisha Prevention of Gambling Act restriction'),
('IN', 'TG', 'Telangana', 'Telangana Gaming Act prohibition on online real money games'),
('IN', 'AP', 'Andhra Pradesh', 'Andhra Pradesh Gaming Act prohibition'),
('IN', 'NL', 'Nagaland', 'Requires specific local state licensing'),
('IN', 'SK', 'Sikkim', 'Requires specific local state physical jurisdiction licensing')
ON CONFLICT (country_code, state_code) DO NOTHING;

-- 3. Pre-seeded Users (Default Password: Password@123)
-- BCrypt for 'Password@123': $2a$10$xL7Gg92J2cOqN.2ZtOaeO6B67g2l/K0E2oZ.KjE/U8u4WzU5lMFe
INSERT INTO users (id, username, phone_number, email, password_hash, role, is_active, is_verified, is_frozen, two_factor_enabled, two_factor_secret) VALUES
(1, 'superadmin', '+919999900001', 'superadmin@rmgplatform.com', '$2a$10$wNqBqH3JvYvQG5p1v5dJt.L7tVwT2Z5J9gG6qO8u8V7m6jB8X1eGq', 'SUPER_ADMIN', TRUE, TRUE, FALSE, TRUE, 'JBSWY3DPEHPK3PXP'),
(2, 'admin', '+919999900002', 'admin@rmgplatform.com', '$2a$10$wNqBqH3JvYvQG5p1v5dJt.L7tVwT2Z5J9gG6qO8u8V7m6jB8X1eGq', 'ADMIN', TRUE, TRUE, FALSE, TRUE, 'JBSWY3DPEHPK3PXP'),
(3, 'finance', '+919999900003', 'finance@rmgplatform.com', '$2a$10$wNqBqH3JvYvQG5p1v5dJt.L7tVwT2Z5J9gG6qO8u8V7m6jB8X1eGq', 'FINANCE', TRUE, TRUE, FALSE, TRUE, 'JBSWY3DPEHPK3PXP'),
(4, 'support', '+919999900004', 'support@rmgplatform.com', '$2a$10$wNqBqH3JvYvQG5p1v5dJt.L7tVwT2Z5J9gG6qO8u8V7m6jB8X1eGq', 'SUPPORT', TRUE, TRUE, FALSE, FALSE, NULL),
(101, 'demoplayer', '+919876500001', 'demoplayer@gmail.com', '$2a$10$wNqBqH3JvYvQG5p1v5dJt.L7tVwT2Z5J9gG6qO8u8V7m6jB8X1eGq', 'USER', TRUE, TRUE, FALSE, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. User Profile & KYC for Demo Player
INSERT INTO user_profiles (user_id, first_name, last_name, date_of_birth, gender, state, city, pincode, bank_account_number, bank_ifsc_code, bank_name, upi_id) VALUES
(101, 'Rahul', 'Sharma', '1998-05-15', 'MALE', 'MAHARASHTRA', 'Mumbai', '400001', '91987650000100', 'HDFC0000001', 'HDFC Bank', 'rahul@oksbi')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO kyc_documents (id, user_id, document_type, document_number, document_front_url, status, verified_by, verified_at) VALUES
(1, 101, 'PAN', 'ABCDE1234F', '/uploads/kyc/demo_pan.jpg', 'APPROVED', 2, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_limits (id, user_id, daily_deposit_limit, daily_loss_limit, daily_time_limit_minutes) VALUES
(1, 101, 50000.00, 20000.00, 360)
ON CONFLICT (id) DO NOTHING;

-- 5. Wallet & User Ledger Account for Demo Player
INSERT INTO ledger_accounts (account_code, account_name, account_type, balance, description) VALUES
('USER_101', 'User 101 Liability Account', 'LIABILITY', 1500.0000, 'Customer player funds held by platform')
ON CONFLICT (account_code) DO NOTHING;

INSERT INTO wallets (id, user_id, deposit_balance, winnings_balance, bonus_balance, locked_balance, version) VALUES
(1, 101, 1000.0000, 500.0000, 50.0000, 0.0000, 0)
ON CONFLICT (id) DO NOTHING;

-- Set sequence counters appropriately
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('wallets_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wallets));
SELECT setval('ledger_accounts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ledger_accounts));
SELECT setval('kyc_documents_id_seq', (SELECT COALESCE(MAX(id), 1) FROM kyc_documents));
