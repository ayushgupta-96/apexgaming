package com.gaming.platform.module.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class Verify2faRequest {
    @NotNull(message = "6-digit TOTP code is required")
    private Integer code;
}
