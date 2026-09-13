package com.gaming.platform.game;

import com.gaming.platform.common.util.ProvablyFairUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class AviatorEngineTest {

    @Test
    @DisplayName("Provably Fair: SHA-256 commitment hash must be deterministic")
    void testSeedHashing() {
        String seed = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
        String hash1 = ProvablyFairUtil.hashSeed(seed);
        String hash2 = ProvablyFairUtil.hashSeed(seed);

        assertNotNull(hash1);
        assertEquals(64, hash1.length());
        assertEquals(hash1, hash2);
    }

    @Test
    @DisplayName("Provably Fair: identical inputs must yield identical crash multipliers")
    void testCrashMultiplier_Deterministic() {
        String serverSeed = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        String clientSeed = "client-seed-xyz";
        long nonce = 42L;
        double houseEdge = 0.03;

        BigDecimal mult1 = ProvablyFairUtil.calculateAviatorCrashPoint(serverSeed, clientSeed, nonce, houseEdge);
        BigDecimal mult2 = ProvablyFairUtil.calculateAviatorCrashPoint(serverSeed, clientSeed, nonce, houseEdge);

        assertNotNull(mult1);
        assertEquals(mult1, mult2);
        assertTrue(mult1.compareTo(BigDecimal.valueOf(1.00)) >= 0, "Crash multiplier must be at least 1.00x");
        assertTrue(mult1.compareTo(BigDecimal.valueOf(1000.00)) <= 0, "Crash multiplier must not exceed cap of 1000.00x");
    }

    @Test
    @DisplayName("Crash Multiplier: Instant crash house edge simulation")
    void testCrashMultiplier_Bounds() {
        for (int i = 0; i < 50; i++) {
            String seed = ProvablyFairUtil.generateServerSeed();
            BigDecimal mult = ProvablyFairUtil.calculateAviatorCrashPoint(seed, "test", i, 0.03);
            assertTrue(mult.compareTo(BigDecimal.valueOf(1.00)) >= 0);
        }
    }
}
