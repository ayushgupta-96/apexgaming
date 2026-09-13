package com.gaming.platform.module.game.ludo.entity;

import com.gaming.platform.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "ludo_players")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LudoPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false)
    private LudoMatch match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String color; // RED, GREEN, YELLOW, BLUE

    @Column(name = "seat_index", nullable = false)
    private Integer seatIndex;

    @Column(name = "is_ready", nullable = false)
    @Builder.Default
    private boolean ready = false;

    @Column(name = "is_connected", nullable = false)
    @Builder.Default
    private boolean connected = true;

    @Column(name = "tokens_finished", nullable = false)
    @Builder.Default
    private Integer tokensFinished = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
