package com.gaming.platform.module.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DepositCreateRequest {

    @NotNull(message = "Deposit amount is required")
    @DecimalMin(value = "100.00", message = "Minimum deposit amount is ₹100.00")
    private BigDecimal amount;

    private String paymentMethod = "UPI";
}
