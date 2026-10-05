package com.gaming.platform.module.admin.dto;

import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class AdminWithdrawalResponse {

    private Long id;
    private String referenceCode;
    private Long userId;
    private String username;
    private String phoneNumber;
    private String email;
    private BigDecimal amount;
    private WithdrawalRequest.WithdrawalStatus status;
    private WithdrawalRequest.DestinationType destinationType;
    private String accountHolderName;
    private String accountNumberOrVpa;
    private String ifscCode;
    private String bankName;
    private String payoutUtr;
    private String proofImageUrl;
    private String rejectionReason;
    private String processedBy;
    private Instant processedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
