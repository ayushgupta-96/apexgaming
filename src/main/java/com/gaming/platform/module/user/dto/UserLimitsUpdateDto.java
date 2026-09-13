package com.gaming.platform.module.user.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UserLimitsUpdateDto {

    @NotNull(message = "Daily deposit limit is required")
    @DecimalMin(value = "100.00", message = "Minimum deposit limit must be at least 100")
    private BigDecimal dailyDepositLimit;

    @NotNull(message = "Daily loss limit is required")
    @DecimalMin(value = "100.00", message = "Minimum loss limit must be at least 100")
    private BigDecimal dailyLossLimit;

    private Integer dailyTimeLimitMinutes;
}
