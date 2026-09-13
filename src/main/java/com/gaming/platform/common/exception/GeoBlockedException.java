package com.gaming.platform.common.exception;

import org.springframework.http.HttpStatus;

public class GeoBlockedException extends BusinessException {
    public GeoBlockedException(String jurisdiction) {
        super("Access blocked: Real-money gaming is legally restricted in jurisdiction: " + jurisdiction, HttpStatus.FORBIDDEN);
    }
}
