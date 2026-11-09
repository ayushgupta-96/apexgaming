package com.gaming.platform.module.game.ludo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@AllArgsConstructor
public class LudoMatchHistoryDto {
    private String matchUuid;
    private String status;
    private BigDecimal stakeAmount;
    private BigDecimal totalPot;
    private BigDecimal winnerPayout;
    private String winnerUsername;
    private String playerColor;
    private String result;
    private Instant createdAt;
}
