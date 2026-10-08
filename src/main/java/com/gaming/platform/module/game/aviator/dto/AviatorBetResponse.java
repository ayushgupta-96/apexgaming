package com.gaming.platform.module.game.aviator.dto;

import com.gaming.platform.module.game.aviator.entity.AviatorBet;
import com.gaming.platform.module.game.common.entity.Bet;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class AviatorBetResponse {

    private String betUuid;
    private String roundUuid;
    private BigDecimal amount;
    private Bet.BetStatus status;
    private BigDecimal multiplier;
    private BigDecimal payoutAmount;
    private BigDecimal autoCashoutMultiplier;
    private BigDecimal cashedOutMultiplier;
    private boolean cashedOut;
    private Instant createdAt;
    private Instant settledAt;
    private Instant cashedOutAt;

    public static AviatorBetResponse from(AviatorBet aviatorBet) {
        Bet bet = aviatorBet.getBet();
        return AviatorBetResponse.builder()
                .betUuid(bet.getBetUuid())
                .roundUuid(bet.getRound().getRoundUuid())
                .amount(bet.getAmount())
                .status(bet.getStatus())
                .multiplier(bet.getMultiplier())
                .payoutAmount(bet.getPayoutAmount())
                .autoCashoutMultiplier(aviatorBet.getAutoCashoutMultiplier())
                .cashedOutMultiplier(aviatorBet.getCashedOutMultiplier())
                .cashedOut(aviatorBet.isCashedOut())
                .createdAt(bet.getCreatedAt())
                .settledAt(bet.getSettledAt())
                .cashedOutAt(aviatorBet.getCashedOutAt())
                .build();
    }
}
