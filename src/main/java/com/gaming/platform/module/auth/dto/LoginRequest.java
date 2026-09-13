package com.gaming.platform.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Username or phone number is required")
    private String usernameOrPhone;

    @NotBlank(message = "Password is required")
    private String password;

    private Integer totpCode;
}
