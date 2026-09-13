package com.gaming.platform.module.auth.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.common.security.UserPrincipal;
import com.gaming.platform.module.auth.dto.*;
import com.gaming.platform.module.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication & Authorization", description = "Endpoints for player registration, login, JWT refresh, and Admin 2FA")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new real-money player", description = "Verifies age (18+), geo-location compliance, creates double-entry ledger account and wallet")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.ok("Registration successful", response));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate player or admin", description = "Validates credentials, checks frozen/self-exclusion status, verifies 2FA for admin roles")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token using valid refresh token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ResponseEntity.ok(ApiResponse.ok("Token refreshed successfully", response));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile and details")
    public ResponseEntity<ApiResponse<UserPrincipal>> getCurrentUser() {
        UserPrincipal principal = SecurityUtils.getCurrentUserPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(principal));
    }

    @PostMapping("/admin/2fa/setup")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Initiate Admin TOTP 2FA setup and get QR code URI")
    public ResponseEntity<ApiResponse<Admin2faSetupResponse>> setup2fa() {
        Long adminId = SecurityUtils.getCurrentUserId();
        Admin2faSetupResponse response = authService.setupAdmin2fa(adminId);
        return ResponseEntity.ok(ApiResponse.ok("2FA setup initiated", response));
    }

    @PostMapping("/admin/2fa/enable")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'FINANCE')")
    @Operation(summary = "Confirm and activate Admin TOTP 2FA with 6-digit code")
    public ResponseEntity<ApiResponse<Void>> enable2fa(@Valid @RequestBody Verify2faRequest request) {
        Long adminId = SecurityUtils.getCurrentUserId();
        authService.verifyAndEnableAdmin2fa(adminId, request.getCode());
        return ResponseEntity.ok(ApiResponse.ok("2FA enabled successfully", null));
    }
}
