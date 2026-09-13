package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApproveDepositRequest {

    @NotNull(message = "Deposit ID is required")
    private Long depositId;

    private String adminNotes;

    private Integer totpCode;
}
