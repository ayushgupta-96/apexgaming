package com.gaming.platform.module.game.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "game_rounds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameRound {

    public enum RoundStatus {
        CREATED,
        BETTING,
        RUNNING,
        COMPLETED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_type", nullable = false, length = 50)
    private GameType gameType;

    @Column(name = "round_uuid", nullable = false, unique = true, length = 64)
    private String roundUuid;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private RoundStatus status = RoundStatus.CREATED;

    @Column(name = "server_seed", nullable = false, length = 128)
    private String serverSeed;

    @Column(name = "server_seed_hash", nullable = false, length = 128)
    private String serverSeedHash;

    @Column(name = "client_seed", length = 128)
    private String clientSeed;

    @Column(nullable = false)
    @Builder.Default
    private Long nonce = 1L;

    @Column(name = "total_bets_count", nullable = false)
    @Builder.Default
    private Integer totalBetsCount = 0;

    @Column(name = "total_bet_amount", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal totalBetAmount = BigDecimal.ZERO;

    @Column(name = "total_payout_amount", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal totalPayoutAmount = BigDecimal.ZERO;

    @Column(name = "house_commission_amount", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal houseCommissionAmount = BigDecimal.ZERO;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
