package com.gaming.platform.module.wallet.controller;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.wallet.dto.WalletResponse;
import com.gaming.platform.module.wallet.entity.Transaction;
import com.gaming.platform.module.wallet.entity.Wallet;
import com.gaming.platform.module.wallet.repository.TransactionRepository;
import com.gaming.platform.module.wallet.repository.WalletRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet & Ledger", description = "Multi-bucket wallet balances and immutable double-entry ledger history")
public class WalletController {

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;

    @GetMapping
    @Operation(summary = "Get user wallet balances (deposit, winnings, bonus, locked)")
    public ResponseEntity<ApiResponse<WalletResponse>> getWallet() {
        Long userId = SecurityUtils.getCurrentUserId();
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException("Wallet not found"));

        WalletResponse response = WalletResponse.builder()
                .depositBalance(wallet.getDepositBalance())
                .winningsBalance(wallet.getWinningsBalance())
                .bonusBalance(wallet.getBonusBalance())
                .lockedBalance(wallet.getLockedBalance())
                .totalPlayableBalance(wallet.getTotalPlayableBalance())
                .totalWithdrawableBalance(wallet.getTotalWithdrawableBalance())
                .build();

        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/transactions")
    @Operation(summary = "Get user transaction and ledger audit history")
    public ResponseEntity<ApiResponse<Page<Transaction>>> getTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = SecurityUtils.getCurrentUserId();
        Page<Transaction> transactions = transactionRepository.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return ResponseEntity.ok(ApiResponse.ok(transactions));
    }
}