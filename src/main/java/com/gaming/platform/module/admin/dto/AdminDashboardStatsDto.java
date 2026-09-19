package com.gaming.platform.module.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardStatsDto {
    private long totalUsers;
    private long pendingDepositsCount;
    private long pendingWithdrawalsCount;
    private long openWhatsAppTicketsCount;
    private BigDecimal totalDepositedVolume;
    private BigDecimal totalWithdrawnVolume;
    private BigDecimal grossGamingRevenue; // Total house commission + edge
    private BigDecimal activeEscrowLiability; // Current active bets in play
}
