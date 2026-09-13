package com.gaming.platform.module.game.ludo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RollDiceResponse {
    private int diceRoll;
    private boolean extraRollAwarded;
    private List<Integer> movableTokenIndices;
    private String currentTurnColor;
    private boolean turnPassed;
}
