package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RejectDepositRequest {

    @NotNull(message = "Deposit ID is required")
    private Long depositId;

    @NotBlank(message = "Rejection reason is required")
    private String rejectionReason;
}
