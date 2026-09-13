package com.gaming.platform.module.game.ludo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LudoGameStateDto {
    private String matchUuid;
    private String status; // WAITING, IN_PROGRESS, COMPLETED, ABANDONED
    private BigDecimal stakeAmount;
    private BigDecimal totalPot;
    private BigDecimal winnerPayout;
    private int maxPlayers;
    private int currentPlayers;
    private String currentTurnColor;
    private Long currentTurnUserId;
    private Integer lastDiceRoll;
    private String winnerColor;
    private Long winnerUserId;
    private List<PlayerInfo> players;
    // Map of Player Color -> array of 4 token positions (-1 = Base, 0-51 = Track, 100+ = Home stretch, 999 = HOME)
    private Map<String, int[]> tokenPositions;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PlayerInfo {
        private Long userId;
        private String username;
        private String color;
        private int seatIndex;
        private boolean ready;
        private boolean connected;
        private int tokensFinished;
    }
}
