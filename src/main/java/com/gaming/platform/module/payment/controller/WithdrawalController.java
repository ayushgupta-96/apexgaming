package com.gaming.platform.module.payment.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.payment.dto.WithdrawalCreateRequest;
import com.gaming.platform.module.payment.dto.WithdrawalResponse;
import com.gaming.platform.module.payment.entity.WithdrawalRequest;
import com.gaming.platform.module.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/withdrawals")
@RequiredArgsConstructor
@Tag(name = "Withdrawal Operations", description = "Player withdrawal request and status tracking")
public class WithdrawalController {

    private final PaymentService paymentService;

    @PostMapping
    @Operation(summary = "Request a withdrawal of winnings", description = "Verifies AML turnover before atomically locking funds via ledger")
    public ResponseEntity<ApiResponse<WithdrawalResponse>> requestWithdrawal(@Valid @RequestBody WithdrawalCreateRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        WithdrawalResponse response = paymentService.requestWithdrawal(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Withdrawal request placed successfully. Pending manual admin payout.", response));
    }

    @GetMapping("/my")
    @Operation(summary = "Get current player withdrawal history")
    public ResponseEntity<ApiResponse<List<WithdrawalRequest>>> getMyWithdrawals() {
        Long userId = SecurityUtils.getCurrentUserId();
        List<WithdrawalRequest> list = paymentService.getUserWithdrawals(userId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }
}
