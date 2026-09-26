package com.gaming.platform.module.compliance.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.compliance.entity.AmlAlert;
import com.gaming.platform.module.compliance.entity.FraudFlag;
import com.gaming.platform.module.compliance.repository.AmlAlertRepository;
import com.gaming.platform.module.compliance.repository.FraudFlagRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.entity.UserLimits;
import com.gaming.platform.module.user.repository.UserLimitsRepository;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.entity.Transaction;
import com.gaming.platform.module.wallet.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AmlService {

    private static final Logger log = LoggerFactory.getLogger(AmlService.class);

    private final AmlAlertRepository amlAlertRepository;
    private final FraudFlagRepository fraudFlagRepository;
    private final UserLimitsRepository userLimitsRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    @Value("${rmg.compliance.aml.single-transaction-alert-threshold:50000.00}")
    private BigDecimal singleTransactionThreshold;

    @Value("${rmg.compliance.aml.daily-cumulative-deposit-threshold:100000.00}")
    private BigDecimal dailyCumulativeDepositThreshold;

    @Value("${rmg.compliance.aml.wagering-turnover-requirement-multiplier:1.0}")
    private double wageringRequirementMultiplier;

    @Transactional
    public void inspectDepositAml(Long userId, BigDecimal amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        // 1. Single large transaction alert
        if (amount.compareTo(singleTransactionThreshold) >= 0) {
            recordAmlAlert(user, "HIGH_SINGLE_TRANSACTION", amount,
                    "Deposit of ₹" + amount + " exceeds single AML threshold of ₹" + singleTransactionThreshold);
        }

        // 2. Daily velocity and limit check
        UserLimits limits = userLimitsRepository.findByUserId(userId).orElseGet(() ->
                userLimitsRepository.save(UserLimits.builder().user(user).build())
        );

        // Reset if new day
        if (limits.getLastResetDate() == null || !limits.getLastResetDate().isEqual(LocalDate.now())) {
            limits.setCurrentDayDeposit(BigDecimal.ZERO);
            limits.setCurrentDayLoss(BigDecimal.ZERO);
            limits.setLastResetDate(LocalDate.now());
        }

        BigDecimal newDailyTotal = limits.getCurrentDayDeposit().add(amount);
        if (newDailyTotal.compareTo(limits.getDailyDepositLimit()) > 0) {
            throw new BusinessException("Deposit exceeds your configured responsible gaming daily limit of ₹" + limits.getDailyDepositLimit());
        }

        if (newDailyTotal.compareTo(dailyCumulativeDepositThreshold) >= 0) {
            recordAmlAlert(user, "HIGH_DAILY_VELOCITY", newDailyTotal,
                    "Cumulative daily deposits reached ₹" + newDailyTotal + ", triggering AML surveillance threshold.");
        }

        limits.setCurrentDayDeposit(newDailyTotal);
        userLimitsRepository.save(limits);
    }

    @Transactional(readOnly = true)
    public void validateWithdrawalCompliance(Long userId, BigDecimal withdrawalAmount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));


        if (user.isFrozen()) {
            throw new BusinessException("Withdrawal rejected: Account is frozen due to active compliance/fraud investigation.");
        }

        // Check Anti-Money Laundering Wagering Turnover Requirement
        // Real-money gaming regulations strictly prohibit using gaming wallets as un-played clearing accounts.
        List<Transaction> recentTransactions = transactionRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 500)).getContent();

        BigDecimal totalDeposited = recentTransactions.stream()
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.DEPOSIT)
                .map(Transaction::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalWagered = recentTransactions.stream()
                .filter(t -> t.getTransactionType() == Transaction.TransactionType.BET_PLACED)
                .map(Transaction::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal requiredWager = totalDeposited.multiply(BigDecimal.valueOf(wageringRequirementMultiplier));

        if (totalWagered.compareTo(requiredWager) < 0) {
            String msg = String.format("AML Compliance Check Failed: Required turnover of 100%% of deposits (₹%s) not met. Total wagered: ₹%s.",
                    requiredWager, totalWagered);
            log.warn("User {} failed AML turnover check: {}", userId, msg);

            recordFraudFlag(user, "NO_PLAY_WITHDRAWAL", FraudFlag.Severity.HIGH,
                    "User attempted withdrawal of ₹" + withdrawalAmount + " without satisfying minimum wagering turnover requirement.");

            throw new BusinessException(msg);
        }

        if (withdrawalAmount.compareTo(singleTransactionThreshold) >= 0) {
            recordAmlAlert(user, "HIGH_SINGLE_TRANSACTION", withdrawalAmount,
                    "Withdrawal request of ₹" + withdrawalAmount + " exceeds AML monitoring threshold of ₹" + singleTransactionThreshold);
        }
    }

    public void recordAmlAlert(User user, String type, BigDecimal amount, String details) {
        AmlAlert alert = AmlAlert.builder()
                .user(user)
                .alertType(type)
                .triggerAmount(amount)
                .details(details)
                .status(AmlAlert.AlertStatus.NEW)
                .build();
        amlAlertRepository.save(alert);
        log.warn("AML Alert generated for user {}: {} - {}", user.getId(), type, details);
    }

    public void recordFraudFlag(User user, String flagType, FraudFlag.Severity severity, String description) {
        FraudFlag flag = FraudFlag.builder()
                .user(user)
                .flagType(flagType)
                .severity(severity)
                .description(description)
                .resolved(false)
                .build();
        fraudFlagRepository.save(flag);
    }
}