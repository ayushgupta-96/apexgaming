package com.gaming.platform.module.game.aviator.entity;

import com.gaming.platform.module.game.common.entity.GameRound;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "aviator_rounds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AviatorRound {

    public enum AviatorStatus {
        WAITING,
        BETTING,
        FLYING,
        CRASHED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false, unique = true)
    private GameRound round;

    @Column(name = "crash_multiplier", nullable = false, precision = 8, scale = 2)
    private BigDecimal crashMultiplier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AviatorStatus status = AviatorStatus.WAITING;

    @Column(name = "flight_start_time")
    private Instant flightStartTime;

    @Column(name = "crashed_at")
    private Instant crashedAt;
}
