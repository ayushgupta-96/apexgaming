package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApproveWithdrawalRequest {

    @NotNull(message = "Withdrawal ID is required")
    private Long withdrawalId;

    @NotBlank(message = "Manual bank transfer UTR is required")
    private String payoutUtr;

    private String proofImageUrl;

    private Integer totpCode;
}
