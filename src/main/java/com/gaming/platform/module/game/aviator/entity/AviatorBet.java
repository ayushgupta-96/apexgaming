package com.gaming.platform.module.game.aviator.entity;

import com.gaming.platform.module.game.common.entity.Bet;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "aviator_bets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AviatorBet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bet_id", nullable = false, unique = true)
    private Bet bet;

    @Column(name = "auto_cashout_multiplier", precision = 8, scale = 2)
    private BigDecimal autoCashoutMultiplier;

    @Column(name = "cashed_out_multiplier", precision = 8, scale = 2)
    private BigDecimal cashedOutMultiplier;

    @Column(name = "is_cashed_out", nullable = false)
    @Builder.Default
    private boolean cashedOut = false;

    @Column(name = "cashed_out_at")
    private Instant cashedOutAt;
}
