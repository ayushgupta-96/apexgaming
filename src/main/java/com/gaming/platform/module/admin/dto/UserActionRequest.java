package com.gaming.platform.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserActionRequest {
    @NotBlank(message = "Reason is required for audit trail")
    private String reason;
}
