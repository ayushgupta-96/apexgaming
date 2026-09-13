package com.gaming.platform.module.game.aviator.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AviatorBetRequest {

    @NotBlank(message = "Round UUID is required")
    private String roundUuid;

    @NotNull(message = "Bet amount is required")
    @DecimalMin(value = "10.00", message = "Minimum bet is ₹10.00")
    @DecimalMax(value = "50000.00", message = "Maximum single bet is ₹50,000.00")
    private BigDecimal amount;

    @DecimalMin(value = "1.01", message = "Auto cashout must be at least 1.01x")
    private BigDecimal autoCashoutMultiplier;
}
