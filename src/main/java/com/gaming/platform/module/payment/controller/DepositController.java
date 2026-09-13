package com.gaming.platform.module.payment.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.payment.dto.DepositCreateRequest;
import com.gaming.platform.module.payment.dto.DepositCreateResponse;
import com.gaming.platform.module.payment.entity.DepositRequest;
import com.gaming.platform.module.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/deposits")
@RequiredArgsConstructor
@Tag(name = "Deposit Operations", description = "Manual deposit initiation via WhatsApp payment proofs")
public class DepositController {

    private final PaymentService paymentService;

    @PostMapping
    @Operation(summary = "Initiate a manual deposit request", description = "Generates unique reference code DEP-..., bank/UPI details, and WhatsApp pre-filled link")
    public ResponseEntity<ApiResponse<DepositCreateResponse>> createDeposit(@Valid @RequestBody DepositCreateRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        DepositCreateResponse response = paymentService.createDepositRequest(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Deposit request created. Please submit proof on WhatsApp.", response));
    }

    @GetMapping("/my")
    @Operation(summary = "Get current player deposit history")
    public ResponseEntity<ApiResponse<List<DepositRequest>>> getMyDeposits() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<DepositRequest> list = paymentService.getUserDeposits(userId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }
}
