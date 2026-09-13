package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RejectWithdrawalRequest {

    @NotNull(message = "Withdrawal ID is required")
    private Long withdrawalId;

    @NotBlank(message = "Rejection reason is required")
    private String rejectionReason;
}
