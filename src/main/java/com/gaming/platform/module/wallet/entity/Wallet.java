package com.gaming.platform.module.wallet.entity;

import com.gaming.platform.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "wallets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "deposit_balance", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal depositBalance = BigDecimal.ZERO;

    @Column(name = "winnings_balance", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal winningsBalance = BigDecimal.ZERO;

    @Column(name = "bonus_balance", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal bonusBalance = BigDecimal.ZERO;

    @Column(name = "locked_balance", nullable = false, precision = 14, scale = 4)
    @Builder.Default
    private BigDecimal lockedBalance = BigDecimal.ZERO;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public BigDecimal getTotalPlayableBalance() {
        return depositBalance.add(winningsBalance).add(bonusBalance);
    }

    public BigDecimal getTotalWithdrawableBalance() {
        return winningsBalance;
    }
}
