package com.gaming.platform.module.game.colour.dto;

import com.gaming.platform.module.game.colour.entity.ColourBet;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ColourBetRequest {

    @NotBlank(message = "Round UUID is required")
    private String roundUuid;

    @NotNull(message = "Target type is required (COLOR or NUMBER)")
    private ColourBet.TargetType targetType;

    @NotBlank(message = "Target value is required (e.g. RED, GREEN, VIOLET, or '0'-'9')")
    private String targetValue;

    @NotNull(message = "Bet amount is required")
    @DecimalMin(value = "10.00", message = "Minimum bet is ₹10.00")
    @DecimalMax(value = "50000.00", message = "Maximum single bet is ₹50,000.00")
    private BigDecimal amount;
}
