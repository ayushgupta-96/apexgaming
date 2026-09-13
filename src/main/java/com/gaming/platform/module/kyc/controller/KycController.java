package com.gaming.platform.module.kyc.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.kyc.dto.KycSubmissionRequest;
import com.gaming.platform.module.kyc.entity.KycDocument;
import com.gaming.platform.module.kyc.service.KycService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/kyc")
@RequiredArgsConstructor
@Tag(name = "KYC & Identity Verification", description = "Legal KYC document submission, age & identity verification endpoints")
public class KycController {

    private final KycService kycService;

    @PostMapping("/upload")
    @Operation(summary = "Submit KYC documents (PAN, Aadhaar, Passport, Voter ID) and selfie")
    public ResponseEntity<ApiResponse<KycDocument>> uploadKyc(@Valid @RequestBody KycSubmissionRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        KycDocument document = kycService.submitKyc(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("KYC document uploaded successfully. Awaiting compliance review.", document));
    }

    @GetMapping("/status")
    @Operation(summary = "Get current user KYC documents and verification status")
    public ResponseEntity<ApiResponse<List<KycDocument>>> getKycStatus() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<KycDocument> history = kycService.getUserKycHistory(userId);
        return ResponseEntity.ok(ApiResponse.ok(history));
    }
}
