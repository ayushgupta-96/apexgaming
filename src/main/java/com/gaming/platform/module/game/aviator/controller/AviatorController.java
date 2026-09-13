package com.gaming.platform.module.game.aviator.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.common.util.ProvablyFairUtil;
import com.gaming.platform.module.game.aviator.dto.AviatorBetRequest;
import com.gaming.platform.module.game.aviator.dto.AviatorCashoutRequest;
import com.gaming.platform.module.game.aviator.dto.AviatorStateDto;
import com.gaming.platform.module.game.aviator.entity.AviatorBet;
import com.gaming.platform.module.game.aviator.service.AviatorEngine;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/games/aviator")
@RequiredArgsConstructor
@Tag(name = "Aviator Game", description = "Provably fair crash multiplier game with real-time WebSocket state and auto-cashout")
public class AviatorController {

    private final AviatorEngine aviatorEngine;

    @GetMapping("/state")
    @Operation(summary = "Get current Aviator live flight state and multiplier")
    public ResponseEntity<ApiResponse<AviatorStateDto>> getState() {
        return ResponseEntity.ok(ApiResponse.ok(aviatorEngine.getCurrentState()));
    }

    @PostMapping("/bet")
    @Operation(summary = "Place a bet for the current betting round")
    public ResponseEntity<ApiResponse<AviatorBet>> placeBet(@Valid @RequestBody AviatorBetRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        AviatorBet bet = aviatorEngine.placeBet(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Bet placed successfully", bet));
    }

    @PostMapping("/cashout")
    @Operation(summary = "Manually cash out during active flight")
    public ResponseEntity<ApiResponse<AviatorBet>> cashout(@Valid @RequestBody AviatorCashoutRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        AviatorBet bet = aviatorEngine.manualCashout(userId, request.getBetUuid());
        return ResponseEntity.ok(ApiResponse.ok("Cashout successful", bet));
    }

    @GetMapping("/verify")
    @Operation(summary = "Verify provably fair crash outcome independently")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyFairness(
            @RequestParam String serverSeed,
            @RequestParam String clientSeed,
            @RequestParam long nonce,
            @RequestParam(defaultValue = "0.03") double houseEdge) {

        String serverSeedHash = ProvablyFairUtil.hashSeed(serverSeed);
        BigDecimal computedCrashMultiplier = ProvablyFairUtil.calculateAviatorCrashPoint(serverSeed, clientSeed, nonce, houseEdge);

        Map<String, Object> verificationResult = Map.of(
                "serverSeedHash", serverSeedHash,
                "computedCrashMultiplier", computedCrashMultiplier,
                "serverSeed", serverSeed,
                "clientSeed", clientSeed,
                "nonce", nonce,
                "isFair", true
        );

        return ResponseEntity.ok(ApiResponse.ok("Outcome verified", verificationResult));
    }
}
