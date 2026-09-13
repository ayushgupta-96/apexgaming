package com.gaming.platform.module.wallet.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.exception.InsufficientBalanceException;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.entity.LedgerAccount;
import com.gaming.platform.module.wallet.entity.LedgerEntry;
import com.gaming.platform.module.wallet.entity.Transaction;
import com.gaming.platform.module.wallet.entity.Wallet;
import com.gaming.platform.module.wallet.repository.LedgerAccountRepository;
import com.gaming.platform.module.wallet.repository.LedgerEntryRepository;
import com.gaming.platform.module.wallet.repository.TransactionRepository;
import com.gaming.platform.module.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);

    public static final String ACC_HOUSE_BANK = "HOUSE_BANK_CLEARING";
    public static final String ACC_HOUSE_COMMISSION = "HOUSE_COMMISSION_REVENUE";
    public static final String ACC_GAME_ESCROW = "GAME_ESCROW_POOL";

    private final WalletRepository walletRepository;
    private final LedgerAccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final LedgerEntryRepository entryRepository;
    private final UserRepository userRepository;

    public String getUserAccountCode(Long userId) {
        return "USER_" + userId;
    }

    /**
     * Initializes a new user ledger account and wallet upon registration.
     */
    @Transactional
    public Wallet initializeUserWallet(User user) {
        String accountCode = getUserAccountCode(user.getId());
        accountRepository.findByAccountCode(accountCode).orElseGet(() -> {
            LedgerAccount account = LedgerAccount.builder()
                    .accountCode(accountCode)
                    .accountName("User " + user.getId() + " (" + user.getUsername() + ") Account")
                    .accountType(LedgerAccount.AccountType.LIABILITY)
                    .balance(BigDecimal.ZERO)
                    .description("User deposited & gaming funds liability")
                    .build();
            return accountRepository.save(account);
        });

        return walletRepository.findByUserId(user.getId()).orElseGet(() -> {
            Wallet wallet = Wallet.builder()
                    .user(user)
                    .depositBalance(BigDecimal.ZERO)
                    .winningsBalance(BigDecimal.ZERO)
                    .bonusBalance(BigDecimal.ZERO)
                    .lockedBalance(BigDecimal.ZERO)
                    .build();
            return walletRepository.save(wallet);
        });
    }

    /**
     * Credits user wallet upon Admin approval of manual WhatsApp deposit.
     * Double-entry:
     *   DEBIT:  HOUSE_BANK_CLEARING (Asset increase)
     *   CREDIT: USER_{userId} (Liability increase)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction processDeposit(Long userId, BigDecimal amount, String referenceCode, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            log.info("Idempotent deposit request already processed: {}", idempotencyKey);
            return existingTx.get();
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Deposit amount must be strictly greater than zero");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found with ID: " + userId));

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        String userAccountCode = getUserAccountCode(userId);
        LedgerAccount userAccount = getOrCreateAccount(userAccountCode, "User " + userId + " Account", LedgerAccount.AccountType.LIABILITY);
        LedgerAccount bankAccount = getOrCreateAccount(ACC_HOUSE_BANK, "House Bank Clearing", LedgerAccount.AccountType.ASSET);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.DEPOSIT)
                .totalAmount(amount)
                .referenceType("DEPOSIT_REQUEST")
                .referenceId(referenceCode)
                .idempotencyKey(idempotencyKey)
                .notes("Manual deposit verified and approved via WhatsApp ticket")
                .build();
        tx = transactionRepository.save(tx);

        // 1. Debit House Bank Clearing
        LedgerEntry debitEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_HOUSE_BANK)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Inbound deposit received in house bank for " + referenceCode)
                .build();

        // 2. Credit User Liability Account
        LedgerEntry creditEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.DEPOSIT)
                .description("Deposit balance credited for " + referenceCode)
                .build();

        entryRepository.save(debitEntry);
        entryRepository.save(creditEntry);

        // Update account balances
        bankAccount.setBalance(bankAccount.getBalance().add(amount));
        userAccount.setBalance(userAccount.getBalance().add(amount));
        accountRepository.save(bankAccount);
        accountRepository.save(userAccount);

        // Update user wallet deposit bucket
        wallet.setDepositBalance(wallet.getDepositBalance().add(amount));
        walletRepository.save(wallet);

        log.info("Deposit successfully processed: user={}, amount={}, ref={}", userId, amount, referenceCode);
        return tx;
    }

    /**
     * Locks funds when user initiates a withdrawal request.
     * Moves funds from winnings_balance to locked_balance.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction lockFundsForWithdrawal(Long userId, BigDecimal amount, String referenceCode, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Withdrawal amount must be greater than zero");
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        if (wallet.getWinningsBalance().compareTo(amount) < 0) {
            throw new InsufficientBalanceException("Insufficient withdrawable winnings balance. Available: " +
                    wallet.getWinningsBalance() + ", Requested: " + amount);
        }

        User user = wallet.getUser();
        String userAccountCode = getUserAccountCode(userId);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.WITHDRAWAL)
                .totalAmount(amount)
                .referenceType("WITHDRAWAL_LOCK")
                .referenceId(referenceCode)
                .idempotencyKey(idempotencyKey)
                .notes("Funds locked pending manual admin transfer and verification")
                .build();
        tx = transactionRepository.save(tx);

        // Debit Winnings sub-bucket, Credit Locked sub-bucket
        LedgerEntry debitEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.WINNINGS)
                .description("Lock winnings for withdrawal: " + referenceCode)
                .build();

        LedgerEntry creditEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.LOCKED)
                .description("Locked funds held for withdrawal: " + referenceCode)
                .build();

        entryRepository.save(debitEntry);
        entryRepository.save(creditEntry);

        // Wallet balance movement
        wallet.setWinningsBalance(wallet.getWinningsBalance().subtract(amount));
        wallet.setLockedBalance(wallet.getLockedBalance().add(amount));
        walletRepository.save(wallet);

        return tx;
    }

    /**
     * Settles withdrawal when Admin completes manual bank/UPI transfer.
     * Double-entry:
     *   DEBIT:  USER_{userId} (Locked sub-bucket, Liability decrease)
     *   CREDIT: HOUSE_BANK_CLEARING (Asset decrease)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction settleWithdrawal(Long userId, BigDecimal amount, String referenceCode, String payoutUtr, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        if (wallet.getLockedBalance().compareTo(amount) < 0) {
            throw new BusinessException("Locked balance is less than withdrawal settlement amount");
        }

        User user = wallet.getUser();
        String userAccountCode = getUserAccountCode(userId);
        LedgerAccount userAccount = getOrCreateAccount(userAccountCode, "User " + userId + " Account", LedgerAccount.AccountType.LIABILITY);
        LedgerAccount bankAccount = getOrCreateAccount(ACC_HOUSE_BANK, "House Bank Clearing", LedgerAccount.AccountType.ASSET);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.WITHDRAWAL)
                .totalAmount(amount)
                .referenceType("WITHDRAWAL_REQUEST")
                .referenceId(referenceCode)
                .idempotencyKey(idempotencyKey)
                .notes("Withdrawal paid manually via bank/UPI. Payout UTR: " + payoutUtr)
                .build();
        tx = transactionRepository.save(tx);

        LedgerEntry debitEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.LOCKED)
                .description("Settled withdrawal payout for " + referenceCode)
                .build();

        LedgerEntry creditEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_HOUSE_BANK)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Outbound bank payout for " + referenceCode + " (UTR: " + payoutUtr + ")")
                .build();

        entryRepository.save(debitEntry);
        entryRepository.save(creditEntry);

        userAccount.setBalance(userAccount.getBalance().subtract(amount));
        bankAccount.setBalance(bankAccount.getBalance().subtract(amount));
        accountRepository.save(userAccount);
        accountRepository.save(bankAccount);

        wallet.setLockedBalance(wallet.getLockedBalance().subtract(amount));
        walletRepository.save(wallet);

        return tx;
    }

    /**
     * Refunds locked funds back to winnings if withdrawal is rejected by admin.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction refundWithdrawal(Long userId, BigDecimal amount, String referenceCode, String reason, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        if (wallet.getLockedBalance().compareTo(amount) < 0) {
            throw new BusinessException("Locked balance is insufficient for withdrawal refund");
        }

        User user = wallet.getUser();
        String userAccountCode = getUserAccountCode(userId);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.BET_REFUND)
                .totalAmount(amount)
                .referenceType("WITHDRAWAL_REFUND")
                .referenceId(referenceCode)
                .idempotencyKey(idempotencyKey)
                .notes("Withdrawal rejected and refunded. Reason: " + reason)
                .build();
        tx = transactionRepository.save(tx);

        LedgerEntry debitEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.LOCKED)
                .description("Release locked funds for rejected withdrawal " + referenceCode)
                .build();

        LedgerEntry creditEntry = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.WINNINGS)
                .description("Refund to winnings balance for " + referenceCode)
                .build();

        entryRepository.save(debitEntry);
        entryRepository.save(creditEntry);

        wallet.setLockedBalance(wallet.getLockedBalance().subtract(amount));
        wallet.setWinningsBalance(wallet.getWinningsBalance().add(amount));
        walletRepository.save(wallet);

        return tx;
    }

    /**
     * Deducts player stake into Game Escrow Pool when placing a bet.
     * Deducts from Bonus -> Deposit -> Winnings balance in order.
     * Double-entry:
     *   DEBIT:  USER_{userId}
     *   CREDIT: GAME_ESCROW_POOL
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction placeBet(Long userId, String gameType, String roundOrMatchId, BigDecimal amount, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Bet amount must be greater than zero");
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        BigDecimal totalAvailable = wallet.getTotalPlayableBalance();
        if (totalAvailable.compareTo(amount) < 0) {
            throw new InsufficientBalanceException("Insufficient playable funds. Required: " + amount + ", Available: " + totalAvailable);
        }

        // Deduct proportionally/in sequence: Bonus -> Deposit -> Winnings
        BigDecimal remainingToDeduct = amount;
        BigDecimal bonusDeduction = BigDecimal.ZERO;
        BigDecimal depositDeduction = BigDecimal.ZERO;
        BigDecimal winningsDeduction = BigDecimal.ZERO;

        if (wallet.getBonusBalance().compareTo(BigDecimal.ZERO) > 0) {
            bonusDeduction = wallet.getBonusBalance().min(remainingToDeduct);
            remainingToDeduct = remainingToDeduct.subtract(bonusDeduction);
        }
        if (remainingToDeduct.compareTo(BigDecimal.ZERO) > 0 && wallet.getDepositBalance().compareTo(BigDecimal.ZERO) > 0) {
            depositDeduction = wallet.getDepositBalance().min(remainingToDeduct);
            remainingToDeduct = remainingToDeduct.subtract(depositDeduction);
        }
        if (remainingToDeduct.compareTo(BigDecimal.ZERO) > 0) {
            winningsDeduction = remainingToDeduct;
        }

        User user = wallet.getUser();
        String userAccountCode = getUserAccountCode(userId);
        LedgerAccount userAccount = getOrCreateAccount(userAccountCode, "User " + userId + " Account", LedgerAccount.AccountType.LIABILITY);
        LedgerAccount escrowAccount = getOrCreateAccount(ACC_GAME_ESCROW, "Game Escrow Pool", LedgerAccount.AccountType.LIABILITY);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.BET_PLACED)
                .totalAmount(amount)
                .referenceType(gameType)
                .referenceId(roundOrMatchId)
                .idempotencyKey(idempotencyKey)
                .notes(gameType + " bet placed on round/match " + roundOrMatchId)
                .build();
        tx = transactionRepository.save(tx);

        // Debit User Account
        LedgerEntry userDebit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(amount)
                .subBucket(depositDeduction.compareTo(BigDecimal.ZERO) > 0 ? LedgerEntry.SubBucket.DEPOSIT : LedgerEntry.SubBucket.WINNINGS)
                .description("Stake debited for " + gameType + " round " + roundOrMatchId)
                .build();

        // Credit Game Escrow Account
        LedgerEntry escrowCredit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_GAME_ESCROW)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(amount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Stake escrow held for " + gameType + " round " + roundOrMatchId)
                .build();

        entryRepository.save(userDebit);
        entryRepository.save(escrowCredit);

        userAccount.setBalance(userAccount.getBalance().subtract(amount));
        escrowAccount.setBalance(escrowAccount.getBalance().add(amount));
        accountRepository.save(userAccount);
        accountRepository.save(escrowAccount);

        // Update wallet buckets
        wallet.setBonusBalance(wallet.getBonusBalance().subtract(bonusDeduction));
        wallet.setDepositBalance(wallet.getDepositBalance().subtract(depositDeduction));
        wallet.setWinningsBalance(wallet.getWinningsBalance().subtract(winningsDeduction));
        walletRepository.save(wallet);

        return tx;
    }

    /**
     * Credits game winnings from Game Escrow Pool to user winnings balance.
     * Double-entry:
     *   DEBIT:  GAME_ESCROW_POOL
     *   CREDIT: USER_{userId} (SubBucket WINNINGS)
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction processGameWin(Long userId, String gameType, String roundOrMatchId, BigDecimal payoutAmount, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        if (payoutAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found for user: " + userId));

        User user = wallet.getUser();
        String userAccountCode = getUserAccountCode(userId);
        LedgerAccount userAccount = getOrCreateAccount(userAccountCode, "User " + userId + " Account", LedgerAccount.AccountType.LIABILITY);
        LedgerAccount escrowAccount = getOrCreateAccount(ACC_GAME_ESCROW, "Game Escrow Pool", LedgerAccount.AccountType.LIABILITY);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(user)
                .transactionType(Transaction.TransactionType.GAME_WIN)
                .totalAmount(payoutAmount)
                .referenceType(gameType)
                .referenceId(roundOrMatchId)
                .idempotencyKey(idempotencyKey)
                .notes("Payout for " + gameType + " round/match " + roundOrMatchId)
                .build();
        tx = transactionRepository.save(tx);

        LedgerEntry escrowDebit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_GAME_ESCROW)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(payoutAmount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Escrow payout for " + gameType + " round " + roundOrMatchId)
                .build();

        LedgerEntry userCredit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(userAccountCode)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(payoutAmount)
                .subBucket(LedgerEntry.SubBucket.WINNINGS)
                .description("Winnings credit for " + gameType + " round " + roundOrMatchId)
                .build();

        entryRepository.save(escrowDebit);
        entryRepository.save(userCredit);

        escrowAccount.setBalance(escrowAccount.getBalance().subtract(payoutAmount));
        userAccount.setBalance(userAccount.getBalance().add(payoutAmount));
        accountRepository.save(escrowAccount);
        accountRepository.save(userAccount);

        wallet.setWinningsBalance(wallet.getWinningsBalance().add(payoutAmount));
        walletRepository.save(wallet);

        return tx;
    }

    /**
     * Settles house rake / commission from Game Escrow Pool into House Revenue.
     * Double-entry:
     *   DEBIT:  GAME_ESCROW_POOL
     *   CREDIT: HOUSE_COMMISSION_REVENUE
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Transaction recordHouseCommission(String gameType, String roundOrMatchId, BigDecimal commissionAmount, String idempotencyKey) {
        Optional<Transaction> existingTx = transactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingTx.isPresent()) {
            return existingTx.get();
        }

        if (commissionAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        LedgerAccount escrowAccount = getOrCreateAccount(ACC_GAME_ESCROW, "Game Escrow Pool", LedgerAccount.AccountType.LIABILITY);
        LedgerAccount revenueAccount = getOrCreateAccount(ACC_HOUSE_COMMISSION, "House Commission Revenue", LedgerAccount.AccountType.REVENUE);

        Transaction tx = Transaction.builder()
                .transactionUuid(UUID.randomUUID().toString())
                .user(null) // Platform revenue
                .transactionType(Transaction.TransactionType.HOUSE_COMMISSION)
                .totalAmount(commissionAmount)
                .referenceType(gameType)
                .referenceId(roundOrMatchId)
                .idempotencyKey(idempotencyKey)
                .notes("House rake commission for " + gameType + " " + roundOrMatchId)
                .build();
        tx = transactionRepository.save(tx);

        LedgerEntry escrowDebit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_GAME_ESCROW)
                .entryType(LedgerEntry.EntryType.DEBIT)
                .amount(commissionAmount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Escrow commission released for " + gameType + " " + roundOrMatchId)
                .build();

        LedgerEntry revenueCredit = LedgerEntry.builder()
                .transaction(tx)
                .accountCode(ACC_HOUSE_COMMISSION)
                .entryType(LedgerEntry.EntryType.CREDIT)
                .amount(commissionAmount)
                .subBucket(LedgerEntry.SubBucket.SYSTEM)
                .description("Commission revenue earned for " + gameType + " " + roundOrMatchId)
                .build();

        entryRepository.save(escrowDebit);
        entryRepository.save(revenueCredit);

        escrowAccount.setBalance(escrowAccount.getBalance().subtract(commissionAmount));
        revenueAccount.setBalance(revenueAccount.getBalance().add(commissionAmount));
        accountRepository.save(escrowAccount);
        accountRepository.save(revenueAccount);

        return tx;
    }

    private LedgerAccount getOrCreateAccount(String accountCode, String name, LedgerAccount.AccountType type) {
        return accountRepository.findByAccountCodeForUpdate(accountCode).orElseGet(() -> {
            LedgerAccount account = LedgerAccount.builder()
                    .accountCode(accountCode)
                    .accountName(name)
                    .accountType(type)
                    .balance(BigDecimal.ZERO)
                    .build();
            return accountRepository.save(account);
        });
    }
}
