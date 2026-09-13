package com.gaming.platform.module.game.colour.entity;

import com.gaming.platform.module.game.common.entity.Bet;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "colour_bets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ColourBet {

    public enum TargetType {
        COLOR,
        NUMBER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bet_id", nullable = false, unique = true)
    private Bet bet;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_value", nullable = false, length = 20)
    private String targetValue; // RED, GREEN, VIOLET, or '0'-'9'
}
