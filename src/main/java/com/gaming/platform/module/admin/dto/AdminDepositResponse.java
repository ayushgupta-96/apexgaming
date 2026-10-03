package com.gaming.platform.module.admin.dto;

import com.gaming.platform.module.payment.entity.DepositRequest;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class AdminDepositResponse {

    private Long id;
    private String referenceCode;
    private Long userId;
    private String username;
    private String phoneNumber;
    private String email;
    private BigDecimal amount;
    private DepositRequest.DepositStatus status;
    private String paymentMethod;
    private String utrNumber;
    private String proofImageUrl;
    private String adminNotes;
    private String processedBy;
    private Instant processedAt;
    private Instant createdAt;
    private Instant updatedAt;
}