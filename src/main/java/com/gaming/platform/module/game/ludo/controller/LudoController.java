package com.gaming.platform.module.game.ludo.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.game.ludo.dto.*;
import com.gaming.platform.module.game.ludo.entity.LudoMatch;
import com.gaming.platform.module.game.ludo.service.LudoEngine;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/games/ludo")
@RequiredArgsConstructor
@Tag(name = "Ludo Game", description = "Server-authoritative real-money Ludo matchmaking, rooms, turn-based dice and token movement")
public class LudoController {

    private final LudoEngine ludoEngine;

    @PostMapping("/rooms")
    @Operation(summary = "Create a new Ludo match room with stake")
    public ResponseEntity<ApiResponse<LudoMatch>> createRoom(@Valid @RequestBody CreateLudoMatchRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        LudoMatch match = ludoEngine.createMatch(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Ludo match created. Waiting for opponent.", match));
    }

    @PostMapping("/rooms/{matchUuid}/join")
    @Operation(summary = "Join an existing waiting Ludo match room")
    public ResponseEntity<ApiResponse<LudoMatch>> joinRoom(@PathVariable String matchUuid) {
        Long userId = SecurityUtils.getCurrentUserId();
        LudoMatch match = ludoEngine.joinMatch(userId, matchUuid);
        return ResponseEntity.ok(ApiResponse.ok("Joined Ludo match", match));
    }

    @GetMapping("/rooms/{matchUuid}/state")
    @Operation(summary = "Get full board and turn state for a Ludo match")
    public ResponseEntity<ApiResponse<LudoGameStateDto>> getGameState(@PathVariable String matchUuid) {
        LudoGameStateDto state = ludoEngine.getMatchState(matchUuid);
        return ResponseEntity.ok(ApiResponse.ok(state));
    }

    @PostMapping("/rooms/{matchUuid}/roll")
    @Operation(summary = "Roll dice for current player's turn")
    public ResponseEntity<ApiResponse<RollDiceResponse>> rollDice(@PathVariable String matchUuid) {
        Long userId = SecurityUtils.getCurrentUserId();
        RollDiceResponse response = ludoEngine.rollDice(userId, matchUuid);
        return ResponseEntity.ok(ApiResponse.ok("Dice rolled", response));
    }

    @PostMapping("/rooms/move")
    @Operation(summary = "Move selected token (0-3) on player turn")
    public ResponseEntity<ApiResponse<LudoGameStateDto>> moveToken(@Valid @RequestBody MoveTokenRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        LudoGameStateDto state = ludoEngine.moveToken(userId, request);
        return ResponseEntity.ok(ApiResponse.ok("Token moved", state));
    }
}
