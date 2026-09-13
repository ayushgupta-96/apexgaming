package com.gaming.platform.common.exception;

import org.springframework.http.HttpStatus;
import java.time.Instant;

public class SelfExclusionException extends BusinessException {
    public SelfExclusionException(Instant until) {
        super(until != null 
            ? "Account is temporarily self-excluded under responsible gaming until: " + until 
            : "Account is permanently self-excluded under responsible gaming regulations.", HttpStatus.FORBIDDEN);
    }
}
