package com.gaming.platform.module.game.aviator.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AviatorCashoutRequest {

    @NotBlank(message = "Bet UUID is required")
    private String betUuid;
}
