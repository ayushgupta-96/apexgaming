package com.gaming.platform.module.payment.dto;

import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserWithdrawalResponse {
    private Long id;
    private String referenceCode;
    private BigDecimal amount;
    private WithdrawalRequest.WithdrawalStatus status;
    private WithdrawalRequest.DestinationType destinationType;
    private String accountHolderName;
    private String accountNumberOrVpa;
    private String payoutUtr;
    private String rejectionReason;
    private Instant processedAt;
    private Instant createdAt;
    private Instant updatedAt;
}