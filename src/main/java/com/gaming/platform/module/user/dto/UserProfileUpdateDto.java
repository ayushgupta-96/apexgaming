package com.gaming.platform.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserProfileUpdateDto {
    private String firstName;
    private String lastName;

    @NotBlank(message = "Bank account number is required")
    private String bankAccountNumber;

    @NotBlank(message = "Bank IFSC code is required")
    private String bankIfscCode;

    @NotBlank(message = "Bank name is required")
    private String bankName;

    @NotBlank(message = "UPI ID is required")
    private String upiId;
}
