package com.gaming.platform.module.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class DepositUtrSubmitRequest {

    @NotBlank(message = "UTR number is required")
    @Pattern(regexp = "\\d{12}", message = "UTR must be exactly 12 digits")
    private String utrNumber;
}