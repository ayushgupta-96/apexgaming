package com.gaming.platform.module.payment.dto;

import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class WithdrawalCreateRequest {

    @NotNull(message = "Withdrawal amount is required")
    @DecimalMin(value = "200.00", message = "Minimum withdrawal amount is ₹200.00")
    private BigDecimal amount;

    @NotNull(message = "Destination type is required (UPI, BANK_ACCOUNT)")
    private WithdrawalRequest.DestinationType destinationType;

    @NotBlank(message = "Account holder name is required")
    private String accountHolderName;

    @NotBlank(message = "Bank account number or UPI VPA is required")
    private String accountNumberOrVpa;

    private String ifscCode;
    private String bankName;
}
