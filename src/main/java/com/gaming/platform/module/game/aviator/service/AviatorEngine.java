package com.gaming.platform.module.game.aviator.service;

import com.gaming.platform.common.exception.BusinessException;
import com.gaming.platform.common.util.ProvablyFairUtil;
import com.gaming.platform.module.game.aviator.dto.AviatorBetRequest;
import com.gaming.platform.module.game.aviator.dto.AviatorStateDto;
import com.gaming.platform.module.game.aviator.entity.AviatorBet;
import com.gaming.platform.module.game.aviator.entity.AviatorRound;
import com.gaming.platform.module.game.aviator.repository.AviatorBetRepository;
import com.gaming.platform.module.game.aviator.repository.AviatorRoundRepository;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
public class AviatorEngine {

    private static final Logger log = LoggerFactory.getLogger(AviatorEngine.class);

    private final GameRoundRepository roundRepository;
    private final AviatorRoundRepository aviatorRoundRepository;
    private final BetRepository betRepository;
    private final AviatorBetRepository aviatorBetRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${rmg.games.aviator.house-edge:0.03}")
    private double houseEdge;

    @Value("${rmg.games.aviator.bet-phase-seconds:8}")
    private int betPhaseDuration;

    private final AtomicReference<GameRound> currentRound = new AtomicReference<>();
    private final AtomicReference<AviatorRound> currentAviatorRound = new AtomicReference<>();
    private final AtomicReference<String> currentStatus = new AtomicReference<>("WAITING");
    private final AtomicInteger countdownSeconds = new AtomicInteger(8);
    private final AtomicReference<BigDecimal> currentMultiplier = new AtomicReference<>(BigDecimal.valueOf(1.00));
    private final AtomicReference<BigDecimal> targetCrashMultiplier = new AtomicReference<>(BigDecimal.valueOf(1.00));
    private final AtomicInteger flightTick = new AtomicInteger(0);
    private final AtomicBoolean isTransitioning = new AtomicBoolean(false);

    private final Deque<BigDecimal> recentCrashHistory = new ConcurrentLinkedDeque<>(
            List.of(BigDecimal.valueOf(2.45), BigDecimal.valueOf(1.18), BigDecimal.valueOf(5.82), BigDecimal.valueOf(1.03), BigDecimal.valueOf(14.20))
    );

    @PostConstruct
    public void init() {
        startNewRound();
    }

    /**
     * Initializes and commits a new provably fair round.
     */
    @Transactional
    public synchronized void startNewRound() {
        String roundUuid = "AV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String serverSeed = ProvablyFairUtil.generateServerSeed();
        String serverSeedHash = ProvablyFairUtil.hashSeed(serverSeed);
        String clientSeed = "client-" + System.currentTimeMillis();
        long nonce = System.currentTimeMillis() % 1000000;

        BigDecimal crashPoint = ProvablyFairUtil.calculateAviatorCrashPoint(serverSeed, clientSeed, nonce, houseEdge);

        GameRound round = GameRound.builder()
                .gameType(GameType.AVIATOR)
                .roundUuid(roundUuid)
                .status(GameRound.RoundStatus.BETTING)
                .serverSeed(serverSeed)
                .serverSeedHash(serverSeedHash)
                .clientSeed(clientSeed)
                .nonce(nonce)
                .build();
        round = roundRepository.save(round);

        AviatorRound aviatorRound = AviatorRound.builder()
                .round(round)
                .crashMultiplier(crashPoint)
                .status(AviatorRound.AviatorStatus.BETTING)
                .build();
        aviatorRound = aviatorRoundRepository.save(aviatorRound);

        currentRound.set(round);
        currentAviatorRound.set(aviatorRound);
        targetCrashMultiplier.set(crashPoint);
        currentMultiplier.set(BigDecimal.valueOf(1.00));
        countdownSeconds.set(betPhaseDuration);
        flightTick.set(0);
        currentStatus.set("BETTING");
        isTransitioning.set(false);

        log.info("Started new Aviator round {} | Hash: {} | Crash: {}x", roundUuid, serverSeedHash, crashPoint);
        broadcastState();
    }

    /**
     * Main simulation loop running every 200 milliseconds.
     */
    @Scheduled(fixedRate = 200)
    public void gameLoop() {
        String status = currentStatus.get();

        if ("BETTING".equals(status)) {
            handleBettingTick();
        } else if ("FLYING".equals(status)) {
            handleFlightTick();
        }
    }

    private void handleBettingTick() {
        int remaining = countdownSeconds.decrementAndGet();
        if (remaining <= 0) {
            currentStatus.set("FLYING");
            flightTick.set(0);
            currentMultiplier.set(BigDecimal.valueOf(1.00));

            GameRound round = currentRound.get();
            if (round != null) {
                round.setStatus(GameRound.RoundStatus.RUNNING);
                round.setStartedAt(Instant.now());
                roundRepository.save(round);
            }
            AviatorRound avRound = currentAviatorRound.get();
            if (avRound != null) {
                avRound.setStatus(AviatorRound.AviatorStatus.FLYING);
                avRound.setFlightStartTime(Instant.now());
                aviatorRoundRepository.save(avRound);
            }
        }
        broadcastState();
    }

    private void handleFlightTick() {
        int tick = flightTick.incrementAndGet();

        // Calculate smooth continuous exponential multiplier curve: M(t) = 1.00 + (t / 10)^1.45
        double seconds = tick * 0.2;
        double multiplierVal = 1.00 + Math.pow(seconds, 1.45) * 0.25;
        BigDecimal newMultiplier = BigDecimal.valueOf(multiplierVal).setScale(2, RoundingMode.FLOOR);

        BigDecimal crashPoint = targetCrashMultiplier.get();

        if (newMultiplier.compareTo(crashPoint) >= 0) {
            triggerCrash(crashPoint);
        } else {
            currentMultiplier.set(newMultiplier);
            checkAutoCashouts(newMultiplier);
            broadcastState();
        }
    }

    @Transactional
    public void checkAutoCashouts(BigDecimal currentMult) {
        GameRound round = currentRound.get();
        if (round == null) return;

        List<AviatorBet> activeBets = aviatorBetRepository.findActiveBetsInRound(round.getId());
        for (AviatorBet avBet : activeBets) {
            if (avBet.getAutoCashoutMultiplier() != null &&
                currentMult.compareTo(avBet.getAutoCashoutMultiplier()) >= 0 &&
                !avBet.isCashedOut()) {
                executeCashout(avBet, avBet.getAutoCashoutMultiplier());
            }
        }
    }

    @Transactional
    public synchronized void triggerCrash(BigDecimal crashPoint) {
        if (!isTransitioning.compareAndSet(false, true)) {
            return;
        }

        currentStatus.set("CRASHED");
        currentMultiplier.set(crashPoint);

        GameRound round = currentRound.get();
        AviatorRound avRound = currentAviatorRound.get();

        if (round != null && avRound != null) {
            round.setStatus(GameRound.RoundStatus.COMPLETED);
            round.setEndedAt(Instant.now());
            roundRepository.save(round);

            avRound.setStatus(AviatorRound.AviatorStatus.CRASHED);
            avRound.setCrashedAt(Instant.now());
            aviatorRoundRepository.save(avRound);

            // Mark any remaining uncached bets as LOST
            List<AviatorBet> lostBets = aviatorBetRepository.findActiveBetsInRound(round.getId());
            for (AviatorBet lost : lostBets) {
                lost.getBet().setStatus(Bet.BetStatus.LOST);
                lost.getBet().setSettledAt(Instant.now());
                betRepository.save(lost.getBet());
            }

            // Push to history
            recentCrashHistory.addFirst(crashPoint);
            while (recentCrashHistory.size() > 15) {
                recentCrashHistory.removeLast();
            }
        }

        log.info("Aviator CRASHED at {}x!", crashPoint);
        broadcastState();

        // Wait 4 seconds and auto-start next round
        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                startNewRound();
            }
        }, 4000);
    }

    /**
     * Places bet during BETTING status.
     */
    @Transactional
    public AviatorBet placeBet(Long userId, AviatorBetRequest request) {
        if (!"BETTING".equals(currentStatus.get())) {
            throw new BusinessException("Betting is locked for current round. Please wait for next round.");
        }

        GameRound round = currentRound.get();
        if (round == null || !round.getRoundUuid().equals(request.getRoundUuid())) {
            throw new BusinessException("Round mismatch or expired");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found"));

        String betUuid = "BET-AV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String idempotencyKey = "AV-BET-" + round.getId() + "-" + userId + "-" + betUuid;

        // Atomically deduct stake into Game Escrow via double-entry ledger
        ledgerService.placeBet(userId, "AVIATOR", round.getRoundUuid(), request.getAmount(), idempotencyKey);

        Bet bet = Bet.builder()
                .round(round)
                .user(user)
                .betUuid(betUuid)
                .amount(request.getAmount())
                .status(Bet.BetStatus.PLACED)
                .build();
        bet = betRepository.save(bet);

        AviatorBet avBet = AviatorBet.builder()
                .bet(bet)
                .autoCashoutMultiplier(request.getAutoCashoutMultiplier())
                .cashedOut(false)
                .build();
        avBet = aviatorBetRepository.save(avBet);

        round.setTotalBetsCount(round.getTotalBetsCount() + 1);
        round.setTotalBetAmount(round.getTotalBetAmount().add(request.getAmount()));
        roundRepository.save(round);

        return avBet;
    }

    /**
     * Manual cashout during flight.
     */
    @Transactional
    public AviatorBet manualCashout(Long userId, String betUuid) {
        if (!"FLYING".equals(currentStatus.get())) {
            throw new BusinessException("Cannot cash out: Plane is not in flight");
        }

        Bet bet = betRepository.findByBetUuid(betUuid)
                .orElseThrow(() -> new BusinessException("Bet not found: " + betUuid));

        if (!bet.getUser().getId().equals(userId)) {
            throw new BusinessException("Unauthorized cashout attempt");
        }

        AviatorBet avBet = aviatorBetRepository.findByBetId(bet.getId())
                .orElseThrow(() -> new BusinessException("Aviator bet record not found"));

        if (avBet.isCashedOut()) {
            throw new BusinessException("Bet has already been cashed out");
        }

        BigDecimal cashoutMult = currentMultiplier.get();
        return executeCashout(avBet, cashoutMult);
    }

    private AviatorBet executeCashout(AviatorBet avBet, BigDecimal multiplier) {
        avBet.setCashedOut(true);
        avBet.setCashedOutMultiplier(multiplier);
        avBet.setCashedOutAt(Instant.now());

        Bet bet = avBet.getBet();
        BigDecimal payout = bet.getAmount().multiply(multiplier).setScale(2, RoundingMode.FLOOR);
        bet.setStatus(Bet.BetStatus.WON);
        bet.setMultiplier(multiplier);
        bet.setPayoutAmount(payout);
        bet.setSettledAt(Instant.now());
        betRepository.save(bet);

        // Credit winnings atomically from Game Escrow Pool
        String winIdempotency = "AV-WIN-" + bet.getId() + "-" + multiplier;
        ledgerService.processGameWin(bet.getUser().getId(), "AVIATOR", bet.getRound().getRoundUuid(), payout, winIdempotency);

        AviatorBet saved = aviatorBetRepository.save(avBet);
        log.info("User {} cashed out at {}x | Payout: ₹{}", bet.getUser().getId(), multiplier, payout);
        return saved;
    }

    public AviatorStateDto getCurrentState() {
        GameRound round = currentRound.get();
        String status = currentStatus.get();

        return AviatorStateDto.builder()
                .roundUuid(round != null ? round.getRoundUuid() : "")
                .status(status)
                .currentMultiplier(currentMultiplier.get())
                .crashMultiplier("CRASHED".equals(status) ? targetCrashMultiplier.get() : null)
                .countdownSeconds(countdownSeconds.get())
                .serverSeedHash(round != null ? round.getServerSeedHash() : "")
                .revealedServerSeed("CRASHED".equals(status) && round != null ? round.getServerSeed() : null)
                .recentHistory(new ArrayList<>(recentCrashHistory))
                .build();
    }

    private void broadcastState() {
        AviatorStateDto state = getCurrentState();
        messagingTemplate.convertAndSend("/topic/games/aviator", state);
    }
}
