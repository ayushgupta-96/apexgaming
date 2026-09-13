package com.gaming.platform.wallet;

import com.gaming.platform.common.exception.InsufficientBalanceException;
import com.gaming.platform.module.user.entity.Role;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.entity.LedgerAccount;
import com.gaming.platform.module.wallet.entity.Transaction;
import com.gaming.platform.module.wallet.entity.Wallet;
import com.gaming.platform.module.wallet.repository.LedgerAccountRepository;
import com.gaming.platform.module.wallet.repository.LedgerEntryRepository;
import com.gaming.platform.module.wallet.repository.TransactionRepository;
import com.gaming.platform.module.wallet.repository.WalletRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LedgerServiceTest {

    @Mock
    private WalletRepository walletRepository;
    @Mock
    private LedgerAccountRepository accountRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private LedgerEntryRepository entryRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private LedgerService ledgerService;

    private User testUser;
    private Wallet testWallet;
    private LedgerAccount houseBankAccount;
    private LedgerAccount userAccount;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(101L)
                .username("testplayer")
                .phoneNumber("+919876500001")
                .role(Role.USER)
                .active(true)
                .build();

        testWallet = Wallet.builder()
                .id(1L)
                .user(testUser)
                .depositBalance(BigDecimal.valueOf(1000.00))
                .winningsBalance(BigDecimal.valueOf(500.00))
                .bonusBalance(BigDecimal.valueOf(50.00))
                .lockedBalance(BigDecimal.ZERO)
                .build();

        houseBankAccount = LedgerAccount.builder()
                .accountCode(LedgerService.ACC_HOUSE_BANK)
                .accountName("House Bank Clearing")
                .accountType(LedgerAccount.AccountType.ASSET)
                .balance(BigDecimal.valueOf(1000000.00))
                .build();

        userAccount = LedgerAccount.builder()
                .accountCode("USER_101")
                .accountName("User 101 Account")
                .accountType(LedgerAccount.AccountType.LIABILITY)
                .balance(BigDecimal.valueOf(1550.00))
                .build();
    }

    @Test
    @DisplayName("Process Deposit: should atomically credit wallet deposit balance and create balanced double entries")
    void testProcessDeposit_Success() {
        String refCode = "DEP-101-1725984000";
        String idempotencyKey = "DEP-APP-" + refCode;
        BigDecimal depositAmount = BigDecimal.valueOf(500.00);

        when(transactionRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findById(101L)).thenReturn(Optional.of(testUser));
        when(walletRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(testWallet));
        when(accountRepository.findByAccountCodeForUpdate(LedgerService.ACC_HOUSE_BANK)).thenReturn(Optional.of(houseBankAccount));
        when(accountRepository.findByAccountCodeForUpdate("USER_101")).thenReturn(Optional.of(userAccount));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));

        Transaction tx = ledgerService.processDeposit(101L, depositAmount, refCode, idempotencyKey);

        assertNotNull(tx);
        assertEquals(Transaction.TransactionType.DEPOSIT, tx.getTransactionType());
        assertEquals(depositAmount, tx.getTotalAmount());
        assertEquals(BigDecimal.valueOf(1500.00), testWallet.getDepositBalance());

        // Verify 2 balanced ledger entries saved (DEBIT House Bank, CREDIT User)
        verify(entryRepository, times(2)).save(any());
        verify(walletRepository, times(1)).save(testWallet);
    }

    @Test
    @DisplayName("Lock Funds For Withdrawal: moves funds from winnings balance to locked balance")
    void testLockFundsForWithdrawal_Success() {
        String refCode = "WDR-101-1725984000";
        String idempotencyKey = "WDR-LOCK-" + refCode;
        BigDecimal withdrawalAmount = BigDecimal.valueOf(300.00);

        when(transactionRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(walletRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(testWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));

        Transaction tx = ledgerService.lockFundsForWithdrawal(101L, withdrawalAmount, refCode, idempotencyKey);

        assertNotNull(tx);
        assertEquals(BigDecimal.valueOf(200.00), testWallet.getWinningsBalance());
        assertEquals(BigDecimal.valueOf(300.00), testWallet.getLockedBalance());
        verify(walletRepository).save(testWallet);
    }

    @Test
    @DisplayName("Lock Funds For Withdrawal: throws InsufficientBalanceException if winnings balance is lower than amount")
    void testPlaceBet_BucketPriorityOrder() {
        String roundUuid = "AV-12345678";
        String idempotencyKey = "BET-1";
        BigDecimal betAmount = BigDecimal.valueOf(100.00); // Has 50 bonus, 1000 deposit

        when(transactionRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(walletRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(testWallet));
        when(accountRepository.findByAccountCodeForUpdate("USER_101")).thenReturn(Optional.of(userAccount));
        when(accountRepository.findByAccountCodeForUpdate(LedgerService.ACC_GAME_ESCROW)).thenReturn(Optional.of(
                LedgerAccount.builder()
                        .accountCode(LedgerService.ACC_GAME_ESCROW)
                        .balance(BigDecimal.ZERO)
                        .build()
        ));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));

        Transaction tx = ledgerService.placeBet(
                101L,
                "AVIATOR",
                roundUuid,
                betAmount,
                idempotencyKey
        );

        assertNotNull(tx);

        assertEquals(0, testWallet.getBonusBalance().compareTo(BigDecimal.ZERO));
        assertEquals(0, testWallet.getDepositBalance().compareTo(BigDecimal.valueOf(950.00)));
        assertEquals(0, testWallet.getWinningsBalance().compareTo(BigDecimal.valueOf(500.00)));
    }
}
