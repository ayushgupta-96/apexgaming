package com.gaming.platform.module.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "user_limits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLimits {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "daily_deposit_limit", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal dailyDepositLimit = BigDecimal.valueOf(25000.00);

    @Column(name = "daily_loss_limit", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal dailyLossLimit = BigDecimal.valueOf(15000.00);

    @Column(name = "daily_time_limit_minutes", nullable = false)
    @Builder.Default
    private Integer dailyTimeLimitMinutes = 360;

    @Column(name = "current_day_deposit", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal currentDayDeposit = BigDecimal.ZERO;

    @Column(name = "current_day_loss", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal currentDayLoss = BigDecimal.ZERO;

    @Column(name = "last_reset_date")
    @Builder.Default
    private LocalDate lastResetDate = LocalDate.now();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
