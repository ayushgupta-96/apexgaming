package com.gaming.platform.module.game.ludo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "ludo_moves")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LudoMove {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false)
    private LudoMatch match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private LudoPlayer player;

    @Column(name = "dice_roll", nullable = false)
    private Integer diceRoll;

    @Column(name = "token_index")
    private Integer tokenIndex;

    @Column(name = "from_position")
    private Integer fromPosition;

    @Column(name = "to_position")
    private Integer toPosition;

    @Column(name = "captured_player_color", length = 20)
    private String capturedPlayerColor;

    @CreationTimestamp
    @Column(name = "move_timestamp", updatable = false)
    private Instant moveTimestamp;
}
