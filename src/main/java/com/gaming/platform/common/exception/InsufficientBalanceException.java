package com.gaming.platform.common.exception;

import org.springframework.http.HttpStatus;

public class InsufficientBalanceException extends BusinessException {
    public InsufficientBalanceException(String message) {
        super(message, HttpStatus.PAYMENT_REQUIRED);
    }
}
