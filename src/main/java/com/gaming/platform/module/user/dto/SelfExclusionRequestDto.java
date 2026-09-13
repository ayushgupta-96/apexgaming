package com.gaming.platform.module.user.dto;

import com.gaming.platform.module.user.entity.SelfExclusion;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SelfExclusionRequestDto {

    @NotNull(message = "Exclusion type is required (COOL_OFF, TEMPORARY, PERMANENT)")
    private SelfExclusion.ExclusionType exclusionType;

    private Integer durationHours; // e.g. 24, 168, 720

    private String reason;
}
