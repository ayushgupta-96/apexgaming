package com.gaming.platform.compliance;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.compliance.entity.AmlAlert;
import com.gaming.platform.module.compliance.entity.FraudFlag;
import com.gaming.platform.module.compliance.repository.AmlAlertRepository;
import com.gaming.platform.module.compliance.repository.FraudFlagRepository;
import com.gaming.platform.module.compliance.service.AmlService;
import com.gaming.platform.module.user.entity.Role;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.entity.UserLimits;
import com.gaming.platform.module.user.repository.UserLimitsRepository;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.entity.Transaction;
import com.gaming.platform.module.wallet.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AmlServiceTest {

    @Mock
    private AmlAlertRepository amlAlertRepository;
    @Mock
    private FraudFlagRepository fraudFlagRepository;
    @Mock
    private UserLimitsRepository userLimitsRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TransactionRepository transactionRepository;

    @InjectMocks
    private AmlService amlService;

    private User verifiedUser;
    private UserLimits userLimits;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(amlService, "singleTransactionThreshold", BigDecimal.valueOf(50000.00));
        ReflectionTestUtils.setField(amlService, "dailyCumulativeDepositThreshold", BigDecimal.valueOf(100000.00));
        ReflectionTestUtils.setField(amlService, "wageringRequirementMultiplier", 1.0);

        verifiedUser = User.builder()
                .id(101L)
                .username("testplayer")
                .role(Role.USER)
                .active(true)
                .verified(true)
                .frozen(false)
                .build();

        userLimits = UserLimits.builder()
                .id(1L)
                .user(verifiedUser)
                .dailyDepositLimit(BigDecimal.valueOf(25000.00))
                .dailyLossLimit(BigDecimal.valueOf(15000.00))
                .currentDayDeposit(BigDecimal.ZERO)
                .lastResetDate(LocalDate.now())
                .build();
    }

    @Test
    @DisplayName("AML Deposit Check: Single large transaction >= ₹50,000 logs AML alert")
    void testDepositAml_LargeTransactionAlert() {
        BigDecimal largeDeposit = BigDecimal.valueOf(60000.00);
        userLimits.setDailyDepositLimit(BigDecimal.valueOf(100000.00)); // allow limit so only AML triggers

        when(userRepository.findById(101L)).thenReturn(Optional.of(verifiedUser));
        when(userLimitsRepository.findByUserId(101L)).thenReturn(Optional.of(userLimits));

        amlService.inspectDepositAml(101L, largeDeposit);

        verify(amlAlertRepository, atLeastOnce()).save(any(AmlAlert.class));
    }

    @Test
    @DisplayName("AML Deposit Check: Exceeding daily limit throws BusinessException")
    void testDepositAml_ExceedsDailyLimit() {
        BigDecimal overLimitDeposit = BigDecimal.valueOf(30000.00); // Daily limit is 25,000

        when(userRepository.findById(101L)).thenReturn(Optional.of(verifiedUser));
        when(userLimitsRepository.findByUserId(101L)).thenReturn(Optional.of(userLimits));

        assertThrows(BusinessException.class, () ->
                amlService.inspectDepositAml(101L, overLimitDeposit)
        );
    }

    @Test
    @DisplayName("AML Wagering Check: Withdrawal fails if 100% deposit turnover requirement is not met")
    void testWithdrawal_FailsWageringTurnoverRequirement() {
        // User deposited ₹1,000 but only placed bets totaling ₹200
        Transaction depTx = Transaction.builder()
                .transactionType(Transaction.TransactionType.DEPOSIT)
                .totalAmount(BigDecimal.valueOf(1000.00))
                .build();
        Transaction betTx = Transaction.builder()
                .transactionType(Transaction.TransactionType.BET_PLACED)
                .totalAmount(BigDecimal.valueOf(200.00))
                .build();

        when(userRepository.findById(101L)).thenReturn(Optional.of(verifiedUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtDesc(eq(101L), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(depTx, betTx)));

        assertThrows(BusinessException.class, () ->
                amlService.validateWithdrawalCompliance(101L, BigDecimal.valueOf(500.00))
        );

        // Verify fraud flag was recorded for no-play withdrawal
        verify(fraudFlagRepository).save(any(FraudFlag.class));
    }
}
