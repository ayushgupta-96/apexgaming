package com.gaming.platform.module.payment.dto;

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
public class DepositCreateResponse {
    private Long depositId;
    private String referenceCode; // e.g. DEP-101-1725984000
    private BigDecimal amount;
    private String officialUpiId;
    private String officialBankName;
    private String officialAccountNo;
    private String officialIfsc;
    private String whatsAppLink;
    private String qrCodeString;
    private String instructions;
    private Instant createdAt;
}
