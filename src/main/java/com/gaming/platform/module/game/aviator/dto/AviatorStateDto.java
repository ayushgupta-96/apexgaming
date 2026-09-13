package com.gaming.platform.module.game.aviator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AviatorStateDto {
    private String roundUuid;
    private String status; // BETTING, FLYING, CRASHED
    private BigDecimal currentMultiplier;
    private BigDecimal crashMultiplier; // Only populated when crashed
    private int countdownSeconds;
    private String serverSeedHash;
    private String revealedServerSeed; // Only populated when crashed
    private List<BigDecimal> recentHistory;
}
