package com.gaming.platform.module.wallet.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class WalletResponse {
    private BigDecimal depositBalance;
    private BigDecimal winningsBalance;
    private BigDecimal bonusBalance;
    private BigDecimal lockedBalance;
    private BigDecimal totalPlayableBalance;
    private BigDecimal totalWithdrawableBalance;
}
