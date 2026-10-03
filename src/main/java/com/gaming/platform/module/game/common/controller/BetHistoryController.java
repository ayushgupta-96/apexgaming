package com.gaming.platform.module.game.common.controller;

import com.gaming.platform.common.response.ApiResponse;
import com.gaming.platform.common.security.SecurityUtils;
import com.gaming.platform.module.game.common.dto.BetHistoryResponse;
import com.gaming.platform.module.game.common.entity.Bet;
import com.gaming.platform.module.game.common.entity.GameType;
import com.gaming.platform.module.game.common.repository.BetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/games/bets")
@RequiredArgsConstructor
public class BetHistoryController {

    private final BetRepository betRepository;

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<BetHistoryResponse>>> getHistory(
            @RequestParam GameType gameType,
            @RequestParam(defaultValue = "20") int size) {

        Long userId = SecurityUtils.getCurrentUserId();
        int pageSize = Math.min(Math.max(size, 1), 50);

        List<BetHistoryResponse> history = betRepository
                .findByUserIdAndRoundGameTypeOrderByCreatedAtDesc(
                        userId,
                        gameType,
                        PageRequest.of(0, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
                )
                .getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(history));
    }

    private BetHistoryResponse toResponse(Bet bet) {
        return BetHistoryResponse.builder()
                .betUuid(bet.getBetUuid())
                .gameType(bet.getRound().getGameType())
                .roundUuid(bet.getRound().getRoundUuid())
                .amount(bet.getAmount())
                .selection(bet.getSelection())
                .multiplier(bet.getMultiplier())
                .payoutAmount(bet.getPayoutAmount())
                .status(bet.getStatus())
                .createdAt(bet.getCreatedAt())
                .settledAt(bet.getSettledAt())
                .build();
    }
}
