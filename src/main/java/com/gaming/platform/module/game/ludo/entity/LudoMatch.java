package com.gaming.platform.module.game.ludo.entity;

import com.gaming.platform.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ludo_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LudoMatch {

    public enum MatchStatus {
        WAITING,
        IN_PROGRESS,
        COMPLETED,
        ABANDONED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_uuid", nullable = false, unique = true, length = 64)
    private String matchUuid;

    @Column(name = "stake_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal stakeAmount;

    @Column(name = "max_players", nullable = false)
    @Builder.Default
    private Integer maxPlayers = 2; // 2 or 4 players

    @Column(name = "current_players", nullable = false)
    @Builder.Default
    private Integer currentPlayers = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private MatchStatus status = MatchStatus.WAITING;

    @Column(name = "current_turn_color", length = 20)
    private String currentTurnColor; // RED, GREEN, YELLOW, BLUE

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_turn_user_id")
    private User currentTurnUser;

    @Column(name = "turn_expires_at")
    private Instant turnExpiresAt;

    @Column(name = "board_state", columnDefinition = "TEXT")
    private String boardState; // JSON serialized state of token coordinates

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_user_id")
    private User winner;

    @Column(name = "total_pot", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal totalPot = BigDecimal.ZERO;

    @Column(name = "commission_amount", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    @Column(name = "winner_payout", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal winnerPayout = BigDecimal.ZERO;

    @OneToMany(mappedBy = "match", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LudoPlayer> players = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
