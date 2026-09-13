package com.gaming.platform.module.game.colour.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.util.ProvablyFairUtil;
import com.gaming.platform.module.game.colour.dto.ColourBetRequest;
import com.gaming.platform.module.game.colour.dto.ColourRoundStateDto;
import com.gaming.platform.module.game.colour.entity.ColourBet;
import com.gaming.platform.module.game.colour.entity.ColourRound;
import com.gaming.platform.module.game.colour.repository.ColourBetRepository;
import com.gaming.platform.module.game.colour.repository.ColourRoundRepository;
import com.gaming.platform.module.game.common.entity.Bet;
import com.gaming.platform.module.game.common.entity.GameRound;
import com.gaming.platform.module.game.common.entity.GameType;
import com.gaming.platform.module.game.common.repository.BetRepository;
import com.gaming.platform.module.game.common.repository.GameRoundRepository;
import com.gaming.platform.module.user.entity.User;
import com.gaming.platform.module.user.repository.UserRepository;
import com.gaming.platform.module.wallet.service.LedgerService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
public class ColourEngine {

    private static final Logger log = LoggerFactory.getLogger(ColourEngine.class);

    private final GameRoundRepository roundRepository;
    private final ColourRoundRepository colourRoundRepository;
    private final BetRepository betRepository;
    private final ColourBetRepository colourBetRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final SimpMessagingTemplate messagingTemplate;

    private final AtomicReference<GameRound> currentRound = new AtomicReference<>();
    private final AtomicReference<ColourRound> currentColourRound = new AtomicReference<>();
    private final AtomicReference<String> currentStatus = new AtomicReference<>("BETTING");
    private final AtomicInteger secondsRemaining = new AtomicInteger(60);
    private final AtomicBoolean isResolving = new AtomicBoolean(false);

    private final Deque<ColourRoundStateDto.ResultItem> recentHistory = new ConcurrentLinkedDeque<>(List.of(
            new ColourRoundStateDto.ResultItem("CP-PREV-1", 7, "GREEN"),
            new ColourRoundStateDto.ResultItem("CP-PREV-2", 2, "RED"),
            new ColourRoundStateDto.ResultItem("CP-PREV-3", 0, "RED_VIOLET"),
            new ColourRoundStateDto.ResultItem("CP-PREV-4", 9, "GREEN"),
            new ColourRoundStateDto.ResultItem("CP-PREV-5", 4, "RED")
    ));

    @PostConstruct
    public void init() {
        startNewRound();
    }

    @Transactional
    public synchronized void startNewRound() {
        String roundUuid = "CP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String serverSeed = ProvablyFairUtil.generateServerSeed();
        String serverSeedHash = ProvablyFairUtil.hashSeed(serverSeed);
        String clientSeed = "client-" + System.currentTimeMillis();
        long nonce = System.currentTimeMillis() % 1000000;

        Instant now = Instant.now();
        Instant bettingEnds = now.plus(50, ChronoUnit.SECONDS);

        GameRound round = GameRound.builder()
                .gameType(GameType.COLOUR_PREDICTION)
                .roundUuid(roundUuid)
                .status(GameRound.RoundStatus.BETTING)
                .serverSeed(serverSeed)
                .serverSeedHash(serverSeedHash)
                .clientSeed(clientSeed)
                .nonce(nonce)
                .startedAt(now)
                .build();
        round = roundRepository.save(round);

        ColourRound colourRound = ColourRound.builder()
                .round(round)
                .bettingEndsAt(bettingEnds)
                .build();
        colourRound = colourRoundRepository.save(colourRound);

        currentRound.set(round);
        currentColourRound.set(colourRound);
        currentStatus.set("BETTING");
        secondsRemaining.set(60);
        isResolving.set(false);

        log.info("Started new Colour Prediction round {} | Hash: {}", roundUuid, serverSeedHash);
        broadcastState();
    }

    /**
     * 1-second countdown clock for the 60-second round.
     */
    @Scheduled(fixedRate = 1000)
    public void clockTick() {
        int rem = secondsRemaining.decrementAndGet();

        if (rem <= 10 && rem > 0 && !"LOCKED".equals(currentStatus.get())) {
            currentStatus.set("LOCKED");
            log.info("Colour Prediction round {} is now LOCKED for betting", currentRound.get().getRoundUuid());
        } else if (rem <= 0) {
            resolveRound();
        }

        broadcastState();
    }

    @Transactional
    public synchronized void resolveRound() {
        if (!isResolving.compareAndSet(false, true)) {
            return;
        }

        currentStatus.set("RESULT");
        GameRound round = currentRound.get();
        ColourRound colourRound = currentColourRound.get();

        if (round == null || colourRound == null) {
            startNewRound();
            return;
        }

        int winningNumber = ProvablyFairUtil.calculateColourNumber(round.getServerSeed(), round.getClientSeed(), round.getNonce());
        String winningColor = ProvablyFairUtil.getWinningColor(winningNumber);

        colourRound.setWinningNumber(winningNumber);
        colourRound.setWinningColor(winningColor);
        colourRound.setSettledAt(Instant.now());
        colourRoundRepository.save(colourRound);

        round.setStatus(GameRound.RoundStatus.COMPLETED);
        round.setEndedAt(Instant.now());

        // Settle all bets
        List<ColourBet> roundBets = colourBetRepository.findByRoundId(round.getId());
        BigDecimal totalPayouts = BigDecimal.ZERO;

        for (ColourBet cb : roundBets) {
            Bet bet = cb.getBet();
            BigDecimal multiplier = calculatePayoutMultiplier(cb.getTargetType(), cb.getTargetValue(), winningNumber, winningColor);

            if (multiplier.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal payout = bet.getAmount().multiply(multiplier).setScale(2, RoundingMode.FLOOR);
                bet.setStatus(Bet.BetStatus.WON);
                bet.setMultiplier(multiplier);
                bet.setPayoutAmount(payout);
                bet.setSettledAt(Instant.now());
                betRepository.save(bet);

                totalPayouts = totalPayouts.add(payout);

                // Double-entry settlement credit
                String winIdempotency = "CP-WIN-" + bet.getId() + "-" + winningNumber;
                ledgerService.processGameWin(bet.getUser().getId(), "COLOUR_PREDICTION", round.getRoundUuid(), payout, winIdempotency);
            } else {
                bet.setStatus(Bet.BetStatus.LOST);
                bet.setSettledAt(Instant.now());
                betRepository.save(bet);
            }
        }

        round.setTotalPayoutAmount(totalPayouts);
        roundRepository.save(round);

        // Update recent history
        recentHistory.addFirst(new ColourRoundStateDto.ResultItem(round.getRoundUuid(), winningNumber, winningColor));
        while (recentHistory.size() > 20) {
            recentHistory.removeLast();
        }

        log.info("Colour round {} resolved: Number={}, Color={} | Total Payout: ₹{}",
                round.getRoundUuid(), winningNumber, winningColor, totalPayouts);
        broadcastState();

        // 5 seconds display period before starting next 60s cycle
        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                startNewRound();
            }
        }, 5000);
    }

    private BigDecimal calculatePayoutMultiplier(ColourBet.TargetType type, String targetVal, int winNum, String winCol) {
        if (type == ColourBet.TargetType.NUMBER) {
            if (Integer.toString(winNum).equals(targetVal)) {
                return BigDecimal.valueOf(9.0);
            }
            return BigDecimal.ZERO;
        }

        String target = targetVal.toUpperCase();
        if ("GREEN".equals(target)) {
            if (winNum == 1 || winNum == 3 || winNum == 7 || winNum == 9) return BigDecimal.valueOf(2.0);
            if (winNum == 5) return BigDecimal.valueOf(1.5); // Green + Violet
        } else if ("RED".equals(target)) {
            if (winNum == 2 || winNum == 4 || winNum == 6 || winNum == 8) return BigDecimal.valueOf(2.0);
            if (winNum == 0) return BigDecimal.valueOf(1.5); // Red + Violet
        } else if ("VIOLET".equals(target)) {
            if (winNum == 0 || winNum == 5) return BigDecimal.valueOf(4.5);
        }

        return BigDecimal.ZERO;
    }

    @Transactional
    public ColourBet placeBet(Long userId, ColourBetRequest request) {
        if (!"BETTING".equals(currentStatus.get())) {
            throw new BusinessException("Betting is locked for current round. Wait for next round.");
        }

        GameRound round = currentRound.get();
        if (round == null || !round.getRoundUuid().equals(request.getRoundUuid())) {
            throw new BusinessException("Round mismatch or expired");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        String betUuid = "BET-CP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String idempotencyKey = "CP-BET-" + round.getId() + "-" + userId + "-" + betUuid;

        // Atomic deduction from player balance into Game Escrow
        ledgerService.placeBet(userId, "COLOUR_PREDICTION", round.getRoundUuid(), request.getAmount(), idempotencyKey);

        Bet bet = Bet.builder()
                .round(round)
                .user(user)
                .betUuid(betUuid)
                .amount(request.getAmount())
                .selection(request.getTargetType() + ":" + request.getTargetValue())
                .status(Bet.BetStatus.PLACED)
                .build();
        bet = betRepository.save(bet);

        ColourBet cb = ColourBet.builder()
                .bet(bet)
                .targetType(request.getTargetType())
                .targetValue(request.getTargetValue().toUpperCase())
                .build();
        cb = colourBetRepository.save(cb);

        round.setTotalBetsCount(round.getTotalBetsCount() + 1);
        round.setTotalBetAmount(round.getTotalBetAmount().add(request.getAmount()));
        roundRepository.save(round);

        return cb;
    }

    public ColourRoundStateDto getCurrentState() {
        GameRound round = currentRound.get();
        ColourRound cr = currentColourRound.get();
        String status = currentStatus.get();

        return ColourRoundStateDto.builder()
                .roundUuid(round != null ? round.getRoundUuid() : "")
                .status(status)
                .secondsRemaining(Math.max(0, secondsRemaining.get()))
                .winningNumber("RESULT".equals(status) && cr != null ? cr.getWinningNumber() : null)
                .winningColor("RESULT".equals(status) && cr != null ? cr.getWinningColor() : null)
                .serverSeedHash(round != null ? round.getServerSeedHash() : "")
                .revealedServerSeed("RESULT".equals(status) && round != null ? round.getServerSeed() : null)
                .recentResults(new ArrayList<>(recentHistory))
                .build();
    }

    private void broadcastState() {
        ColourRoundStateDto state = getCurrentState();
        messagingTemplate.convertAndSend("/topic/games/colour", state);
    }
}
