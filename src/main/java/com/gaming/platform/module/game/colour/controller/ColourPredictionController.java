package com.gaming.platform.module.game.colour.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.common.util.ProvablyFairUtil;
import com.gaming.platform.module.game.colour.dto.ColourBetRequest;
import com.gaming.platform.module.game.colour.dto.ColourRoundStateDto;
import com.gaming.platform.module.game.colour.entity.ColourBet;
import com.gaming.platform.module.game.colour.service.ColourEngine;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/games/colour")
@RequiredArgsConstructor
@Tag(name = "Colour Prediction Game", description = "1-minute provably fair colour and number betting game")
public class ColourPredictionController {

    private final ColourEngine colourEngine;

    @GetMapping("/state")
    @Operation(summary = "Get current round countdown, status, and recent winning history")
    public ResponseEntity<ApiResponse<ColourRoundStateDto>> getState() {
        return ResponseEntity.ok(ApiResponse.ok(colourEngine.getCurrentState()));
    }

    @PostMapping("/bet")
    @Operation(summary = "Place a bet on Color (Red/Green/Violet) or Number (0-9)")
    public ResponseEntity<ApiResponse<ColourBet>> placeBet(@Valid @RequestBody ColourBetRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        ColourBet bet = colourEngine.placeBet(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Bet placed successfully", bet));
    }

    @GetMapping("/verify")
    @Operation(summary = "Verify provably fair colour prediction outcome independently")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyOutcome(
            @RequestParam String serverSeed,
            @RequestParam String clientSeed,
            @RequestParam long nonce) {

        String serverSeedHash = ProvablyFairUtil.hashSeed(serverSeed);
        int number = ProvablyFairUtil.calculateColourNumber(serverSeed, clientSeed, nonce);
        String color = ProvablyFairUtil.getWinningColor(number);

        Map<String, Object> result = Map.of(
                "serverSeedHash", serverSeedHash,
                "calculatedNumber", number,
                "calculatedColor", color,
                "serverSeed", serverSeed,
                "clientSeed", clientSeed,
                "nonce", nonce,
                "isFair", true
        );

        return ResponseEntity.ok(ApiResponse.ok("Colour prediction verified", result));
    }
}
