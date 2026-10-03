package com.gaming.platform.module.game.common.dto;

import com.gaming.platform.module.game.common.entity.Bet;
import com.gaming.platform.module.game.common.entity.GameType;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class BetHistoryResponse {
    private String betUuid;
    private GameType gameType;
    private String roundUuid;
    private BigDecimal amount;
    private String selection;
    private BigDecimal multiplier;
    private BigDecimal payoutAmount;
    private Bet.BetStatus status;
    private Instant createdAt;
    private Instant settledAt;
}
