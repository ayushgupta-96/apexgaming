package com.gaming.platform.module.game.colour.entity;

import com.gaming.platform.module.game.common.entity.GameRound;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "colour_rounds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ColourRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false, unique = true)
    private GameRound round;

    @Column(name = "winning_number")
    private Integer winningNumber; // 0 to 9

    @Column(name = "winning_color", length = 20)
    private String winningColor; // RED, GREEN, VIOLET, RED_VIOLET, GREEN_VIOLET

    @Column(name = "price_indicator", precision = 10, scale = 2)
    private BigDecimal priceIndicator;

    @Column(name = "betting_ends_at", nullable = false)
    private Instant bettingEndsAt;

    @Column(name = "settled_at")
    private Instant settledAt;
}
