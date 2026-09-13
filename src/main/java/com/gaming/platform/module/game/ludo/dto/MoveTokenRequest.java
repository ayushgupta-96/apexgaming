package com.gaming.platform.module.game.ludo.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MoveTokenRequest {

    @NotBlank(message = "Match UUID is required")
    private String matchUuid;

    @NotNull(message = "Token index (0 to 3) is required")
    @Min(0)
    @Max(3)
    private Integer tokenIndex;
}
