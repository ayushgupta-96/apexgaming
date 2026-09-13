package com.gaming.platform.module.game.ludo.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.module.game.ludo.dto.*;
import com.gaming.platform.module.game.ludo.entity.LudoMatch;
import com.gaming.platform.module.game.ludo.entity.LudoMove;
import com.gaming.platform.module.game.ludo.entity.LudoPlayer;
import com.gaming.platform.module.game.ludo.repository.LudoMatchRepository;
import com.gaming.platform.module.game.ludo.repository.LudoMoveRepository;
import com.gaming.platform.module.game.ludo.repository.LudoPlayerRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class LudoEngine {

    private static final Logger log = LoggerFactory.getLogger(LudoEngine.class);

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Set<Integer> SAFE_CELLS = Set.of(0, 8, 13, 21, 26, 34, 39, 47);
    private static final String[] COLORS = {"RED", "GREEN", "YELLOW", "BLUE"};
    private static final int HOME_POSITION = 999;

    private final LudoMatchRepository matchRepository;
    private final LudoPlayerRepository playerRepository;
    private final LudoMoveRepository moveRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${rmg.games.ludo.house-commission-rate:0.08}")
    private double commissionRate;

    // Cache active match rolls: matchUuid -> last roll
    private final Map<String, Integer> lastRolls = new HashMap<>();

    @Transactional
    public LudoMatch createMatch(Long userId, CreateLudoMatchRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        String matchUuid = "LUDO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        // Lock player stake into Game Escrow
        String idempotencyKey = "LUDO-STAKE-" + matchUuid + "-" + userId;
        ledgerService.placeBet(userId, "LUDO", matchUuid, request.getStakeAmount(), idempotencyKey);

        Map<String, int[]> initialBoard = new HashMap<>();
        initialBoard.put("RED", new int[]{-1, -1, -1, -1});
        initialBoard.put("GREEN", new int[]{-1, -1, -1, -1});
        if (request.getMaxPlayers() > 2) {
            initialBoard.put("YELLOW", new int[]{-1, -1, -1, -1});
            initialBoard.put("BLUE", new int[]{-1, -1, -1, -1});
        }

        String serializedBoard;
        try {
            serializedBoard = objectMapper.writeValueAsString(initialBoard);
        } catch (Exception e) {
            serializedBoard = "{}";
        }

        LudoMatch match = LudoMatch.builder()
                .matchUuid(matchUuid)
                .stakeAmount(request.getStakeAmount())
                .maxPlayers(request.getMaxPlayers())
                .currentPlayers(1)
                .status(LudoMatch.MatchStatus.WAITING)
                .boardState(serializedBoard)
                .totalPot(request.getStakeAmount())
                .build();
        match = matchRepository.save(match);

        LudoPlayer creator = LudoPlayer.builder()
                .match(match)
                .user(user)
                .color("RED")
                .seatIndex(0)
                .ready(true)
                .connected(true)
                .build();
        playerRepository.save(creator);

        return match;
    }

    @Transactional
    public LudoMatch joinMatch(Long userId, String matchUuid) {
        LudoMatch match = matchRepository.findByMatchUuid(matchUuid)
                .orElseThrow(() -> new BusinessException("Ludo match not found: " + matchUuid));

        if (match.getStatus() != LudoMatch.MatchStatus.WAITING) {
            throw new BusinessException("Match is not in waiting state");
        }

        if (match.getCurrentPlayers() >= match.getMaxPlayers()) {
            throw new BusinessException("Match is already full");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        if (playerRepository.findByMatchIdAndUserId(match.getId(), userId).isPresent()) {
            throw new BusinessException("You have already joined this match");
        }

        // Deduct stake into Game Escrow
        String idempotencyKey = "LUDO-STAKE-" + matchUuid + "-" + userId;
        ledgerService.placeBet(userId, "LUDO", matchUuid, match.getStakeAmount(), idempotencyKey);

        int seat = match.getCurrentPlayers();
        String color = COLORS[seat];

        LudoPlayer player = LudoPlayer.builder()
                .match(match)
                .user(user)
                .color(color)
                .seatIndex(seat)
                .ready(true)
                .connected(true)
                .build();
        playerRepository.save(player);

        match.setCurrentPlayers(match.getCurrentPlayers() + 1);
        match.setTotalPot(match.getTotalPot().add(match.getStakeAmount()));

        // Start match if room is full
        if (match.getCurrentPlayers().equals(match.getMaxPlayers())) {
            match.setStatus(LudoMatch.MatchStatus.IN_PROGRESS);
            match.setCurrentTurnColor("RED");
            LudoPlayer firstPlayer = playerRepository.findByMatchIdAndColor(match.getId(), "RED").orElseThrow();
            match.setCurrentTurnUser(firstPlayer.getUser());
            match.setTurnExpiresAt(Instant.now().plus(15, ChronoUnit.SECONDS));

            BigDecimal commission = match.getTotalPot().multiply(BigDecimal.valueOf(commissionRate)).setScale(2, RoundingMode.HALF_UP);
            match.setCommissionAmount(commission);
            match.setWinnerPayout(match.getTotalPot().subtract(commission));
        }

        match = matchRepository.save(match);
        broadcastMatchState(match);
        return match;
    }

    @Transactional
    public RollDiceResponse rollDice(Long userId, String matchUuid) {
        LudoMatch match = matchRepository.findByMatchUuid(matchUuid)
                .orElseThrow(() -> new BusinessException("Match not found"));

        if (match.getStatus() != LudoMatch.MatchStatus.IN_PROGRESS) {
            throw new BusinessException("Match is not in progress");
        }

        if (!match.getCurrentTurnUser().getId().equals(userId)) {
            throw new BusinessException("It is not your turn to roll!");
        }

        // Secure Random Dice 1..6
        int diceRoll = SECURE_RANDOM.nextInt(6) + 1;
        lastRolls.put(matchUuid, diceRoll);

        Map<String, int[]> board = parseBoardState(match.getBoardState());
        int[] playerTokens = board.get(match.getCurrentTurnColor());

        List<Integer> movableIndices = new ArrayList<>();
        for (int i = 0; i < playerTokens.length; i++) {
            if (isValidMove(playerTokens[i], diceRoll)) {
                movableIndices.add(i);
            }
        }

        boolean extraRoll = (diceRoll == 6);
        boolean turnPassed = movableIndices.isEmpty() && !extraRoll;

        if (turnPassed) {
            passTurnToNextPlayer(match);
        } else {
            match.setTurnExpiresAt(Instant.now().plus(15, ChronoUnit.SECONDS));
            matchRepository.save(match);
        }

        broadcastMatchState(match);

        return RollDiceResponse.builder()
                .diceRoll(diceRoll)
                .extraRollAwarded(extraRoll)
                .movableTokenIndices(movableIndices)
                .currentTurnColor(match.getCurrentTurnColor())
                .turnPassed(turnPassed)
                .build();
    }

    @Transactional
    public LudoGameStateDto moveToken(Long userId, MoveTokenRequest request) {
        LudoMatch match = matchRepository.findByMatchUuid(request.getMatchUuid())
                .orElseThrow(() -> new BusinessException("Match not found"));

        if (!match.getCurrentTurnUser().getId().equals(userId)) {
            throw new BusinessException("Not your turn");
        }

        Integer lastRoll = lastRolls.get(request.getMatchUuid());
        if (lastRoll == null) {
            throw new BusinessException("You must roll the dice before moving a token");
        }

        Map<String, int[]> board = parseBoardState(match.getBoardState());
        String turnColor = match.getCurrentTurnColor();
        int[] tokens = board.get(turnColor);
        int currentPos = tokens[request.getTokenIndex()];

        if (!isValidMove(currentPos, lastRoll)) {
            throw new BusinessException("Invalid token move");
        }

        // Execute Move
        int newPos;
        if (currentPos == -1) {
            // Spawn out to start cell
            newPos = getStartCell(turnColor);
        } else {
            newPos = calculateNextPosition(turnColor, currentPos, lastRoll);
        }

        tokens[request.getTokenIndex()] = newPos;

        // Check Capture on track
        boolean captured = false;
        String capturedColor = null;
        if (newPos >= 0 && newPos <= 51 && !SAFE_CELLS.contains(newPos)) {
            for (Map.Entry<String, int[]> entry : board.entrySet()) {
                if (!entry.getKey().equals(turnColor)) {
                    int[] oppTokens = entry.getValue();
                    for (int j = 0; j < oppTokens.length; j++) {
                        if (oppTokens[j] == newPos) {
                            oppTokens[j] = -1; // Send back to base
                            captured = true;
                            capturedColor = entry.getKey();
                            log.info("Player {} captured {} at cell {}", turnColor, capturedColor, newPos);
                        }
                    }
                }
            }
        }

        // Save move log
        LudoPlayer player = playerRepository.findByMatchIdAndColor(match.getId(), turnColor).orElseThrow();
        LudoMove move = LudoMove.builder()
                .match(match)
                .player(player)
                .diceRoll(lastRoll)
                .tokenIndex(request.getTokenIndex())
                .fromPosition(currentPos)
                .toPosition(newPos)
                .capturedPlayerColor(capturedColor)
                .build();
        moveRepository.save(move);

        // Check Win Condition (all tokens finished or first token home in quick match)
        boolean hasWon = Arrays.stream(tokens).allMatch(p -> p == HOME_POSITION) || tokens[request.getTokenIndex()] == HOME_POSITION;
        if (hasWon) {
            settleMatchWinner(match, player);
        } else {
            // If rolled 6 or captured opponent token, get extra turn; otherwise next player
            if (lastRoll != 6 && !captured) {
                passTurnToNextPlayer(match);
            } else {
                match.setTurnExpiresAt(Instant.now().plus(15, ChronoUnit.SECONDS));
            }
        }

        lastRolls.remove(request.getMatchUuid());
        match.setBoardState(serializeBoard(board));
        match = matchRepository.save(match);

        LudoGameStateDto state = buildGameState(match, board);
        messagingTemplate.convertAndSend("/topic/games/ludo/" + match.getMatchUuid(), state);
        return state;
    }

    private void settleMatchWinner(LudoMatch match, LudoPlayer winnerPlayer) {
        match.setStatus(LudoMatch.MatchStatus.COMPLETED);
        match.setWinner(winnerPlayer.getUser());

        // Settle double-entry ledger:
        // 1. Credit House Commission to Revenue
        String commIdempotency = "LUDO-COMM-" + match.getMatchUuid();
        ledgerService.recordHouseCommission("LUDO", match.getMatchUuid(), match.getCommissionAmount(), commIdempotency);

        // 2. Credit Winner with Winnings Balance
        String winIdempotency = "LUDO-WIN-" + match.getMatchUuid() + "-" + winnerPlayer.getUser().getId();
        ledgerService.processGameWin(winnerPlayer.getUser().getId(), "LUDO", match.getMatchUuid(), match.getWinnerPayout(), winIdempotency);

        log.info("Ludo match {} completed! Winner: {} (₹{}) | Commission: ₹{}",
                match.getMatchUuid(), winnerPlayer.getUser().getUsername(), match.getWinnerPayout(), match.getCommissionAmount());
    }

    private void passTurnToNextPlayer(LudoMatch match) {
        List<LudoPlayer> players = playerRepository.findByMatchId(match.getId());
        players.sort(Comparator.comparingInt(LudoPlayer::getSeatIndex));

        int currentIndex = -1;
        for (int i = 0; i < players.size(); i++) {
            if (players.get(i).getColor().equals(match.getCurrentTurnColor())) {
                currentIndex = i;
                break;
            }
        }

        int nextIndex = (currentIndex + 1) % players.size();
        LudoPlayer nextPlayer = players.get(nextIndex);

        match.setCurrentTurnColor(nextPlayer.getColor());
        match.setCurrentTurnUser(nextPlayer.getUser());
        match.setTurnExpiresAt(Instant.now().plus(15, ChronoUnit.SECONDS));
    }

    private boolean isValidMove(int currentPos, int diceRoll) {
        if (currentPos == HOME_POSITION) return false;
        if (currentPos == -1) return diceRoll == 6;
        if (currentPos >= 100) return (currentPos + diceRoll) <= 105;
        return true;
    }

    private int getStartCell(String color) {
        return switch (color) {
            case "RED" -> 0;
            case "GREEN" -> 13;
            case "YELLOW" -> 26;
            case "BLUE" -> 39;
            default -> 0;
        };
    }

    private int calculateNextPosition(String color, int currentPos, int diceRoll) {
        if (currentPos >= 100) {
            int newHome = currentPos + diceRoll;
            return (newHome >= 105) ? HOME_POSITION : newHome;
        }
        int nextPos = (currentPos + diceRoll) % 52;
        int homeEntry = switch (color) {
            case "RED" -> 50;
            case "GREEN" -> 11;
            case "YELLOW" -> 24;
            case "BLUE" -> 37;
            default -> 50;
        };
        if (currentPos <= homeEntry && (currentPos + diceRoll) > homeEntry) {
            int overshoot = (currentPos + diceRoll) - homeEntry - 1;
            return 100 + overshoot;
        }
        return nextPos;
    }

    private Map<String, int[]> parseBoardState(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private String serializeBoard(Map<String, int[]> board) {
        try {
            return objectMapper.writeValueAsString(board);
        } catch (Exception e) {
            return "{}";
        }
    }

    public LudoGameStateDto getMatchState(String matchUuid) {
        LudoMatch match = matchRepository.findByMatchUuid(matchUuid)
                .orElseThrow(() -> new BusinessException("Match not found"));
        return buildGameState(match, parseBoardState(match.getBoardState()));
    }

    private LudoGameStateDto buildGameState(LudoMatch match, Map<String, int[]> board) {
        List<LudoPlayer> players = playerRepository.findByMatchId(match.getId());
        List<LudoGameStateDto.PlayerInfo> playerInfos = players.stream()
                .map(p -> new LudoGameStateDto.PlayerInfo(
                        p.getUser().getId(),
                        p.getUser().getUsername(),
                        p.getColor(),
                        p.getSeatIndex(),
                        p.isReady(),
                        p.isConnected(),
                        p.getTokensFinished()
                ))
                .toList();

        return LudoGameStateDto.builder()
                .matchUuid(match.getMatchUuid())
                .status(match.getStatus().name())
                .stakeAmount(match.getStakeAmount())
                .totalPot(match.getTotalPot())
                .winnerPayout(match.getWinnerPayout())
                .maxPlayers(match.getMaxPlayers())
                .currentPlayers(match.getCurrentPlayers())
                .currentTurnColor(match.getCurrentTurnColor())
                .currentTurnUserId(match.getCurrentTurnUser() != null ? match.getCurrentTurnUser().getId() : null)
                .lastDiceRoll(lastRolls.get(match.getMatchUuid()))
                .winnerColor(match.getWinner() != null ? match.getCurrentTurnColor() : null)
                .winnerUserId(match.getWinner() != null ? match.getWinner().getId() : null)
                .players(playerInfos)
                .tokenPositions(board)
                .build();
    }

    private void broadcastMatchState(LudoMatch match) {
        LudoGameStateDto state = getMatchState(match.getMatchUuid());
        messagingTemplate.convertAndSend("/topic/games/ludo/" + match.getMatchUuid(), state);
    }
}
