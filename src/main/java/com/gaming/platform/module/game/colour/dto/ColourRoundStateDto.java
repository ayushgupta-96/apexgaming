package com.gaming.platform.module.game.colour.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ColourRoundStateDto {
    private String roundUuid;
    private String status; // BETTING, LOCKED, RESULT
    private int secondsRemaining;
    private Integer winningNumber;
    private String winningColor;
    private String serverSeedHash;
    private String revealedServerSeed;
    private List<ResultItem> recentResults;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ResultItem {
        private String roundUuid;
        private int number;
        private String color;
    }
}
