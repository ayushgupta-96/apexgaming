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

    @InjectMocks
    private AmlService amlService;

    private User verifiedUser;
    private UserLimits userLimits;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(amlService, "singleTransactionThreshold", BigDecimal.valueOf(50000.00));
        ReflectionTestUtils.setField(amlService, "dailyCumulativeDepositThreshold", BigDecimal.valueOf(100000.00));

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
    @DisplayName("AML Withdrawal Check: does not require deposit turnover")
    void testWithdrawal_AllowsWithdrawalWithoutWageringTurnover() {
        when(userRepository.findById(101L)).thenReturn(Optional.of(verifiedUser));

        assertDoesNotThrow(() ->
                amlService.validateWithdrawalCompliance(101L, BigDecimal.valueOf(500.00))
        );

        verify(fraudFlagRepository, never()).save(any(FraudFlag.class));
    }
}
