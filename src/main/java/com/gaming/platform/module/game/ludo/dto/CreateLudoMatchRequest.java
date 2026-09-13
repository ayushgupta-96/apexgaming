package com.gaming.platform.module.game.ludo.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateLudoMatchRequest {

    @NotNull(message = "Stake amount is required")
    @DecimalMin(value = "20.00", message = "Minimum Ludo stake is ₹20.00")
    private BigDecimal stakeAmount;

    @Min(value = 2, message = "Minimum 2 players")
    @Max(value = 4, message = "Maximum 4 players")
    private int maxPlayers = 2;
}
