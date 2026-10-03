package com.gaming.platform.module.payment.dto;

import com.gaming.platform.module.payment.entity.DepositRequest;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class UserDepositResponse {
    private Long id;
    private String referenceCode;
    private BigDecimal amount;
    private DepositRequest.DepositStatus status;
    private String paymentMethod;
    private String utrNumber;
    private String adminNotes;
    private Instant processedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
