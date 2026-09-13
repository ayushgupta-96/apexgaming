package com.gaming.platform.common.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

public class ProvablyFairUtil {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String SHA256 = "SHA-256";

    /**
     * Generates a 256-bit cryptographically secure random server seed as a 64-character hex string.
     */
    public static String generateServerSeed() {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        return HexFormat.of().formatHex(randomBytes);
    }

    /**
     * Computes the SHA-256 hash commitment of a seed to publicly display before betting.
     */
    public static String hashSeed(String seed) {
        try {
            MessageDigest digest = MessageDigest.getInstance(SHA256);
            byte[] hash = digest.digest(seed.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }

    /**
     * Computes HMAC-SHA256 of (clientSeed + ":" + nonce) using serverSeed as the HMAC key.
     */
    public static String computeHmac(String serverSeed, String clientSeed, long nonce) {
        try {
            Mac hmac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKey = new SecretKeySpec(serverSeed.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            hmac.init(secretKey);
            String message = (clientSeed != null ? clientSeed : "default_client_seed") + ":" + nonce;
            byte[] bytes = hmac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (Exception e) {
            throw new RuntimeException("HMAC computation failed", e);
        }
    }

    /**
     * Derives deterministic Aviator Crash Multiplier with configurable house edge (e.g. 0.03 = 3%).
     * Returns a BigDecimal rounded to 2 decimal places >= 1.00.
     */
    public static BigDecimal calculateAviatorCrashPoint(String serverSeed, String clientSeed, long nonce, double houseEdge) {
        String hmac = computeHmac(serverSeed, clientSeed, nonce);

        // Extract first 13 hex characters (52 bits) for standard uniform floating point division
        long hexValue = Long.parseLong(hmac.substring(0, 13), 16);
        double max52BitInt = Math.pow(2, 52);
        double uniformFraction = hexValue / max52BitInt; // Value in [0, 1)

        // If outcome falls in the house-edge fraction, crash immediately at 1.00x
        if (uniformFraction < houseEdge) {
            return BigDecimal.valueOf(1.00).setScale(2, RoundingMode.HALF_UP);
        }

        // Standard crash distribution: (1 - houseEdge) / (1 - uniformFraction)
        double crashMultiplier = (1.00 - houseEdge) / (1.00 - uniformFraction);

        // Cap maximum multiplier at 1000.00x to prevent platform bankroll insolvency
        if (crashMultiplier > 1000.00) {
            crashMultiplier = 1000.00;
        }

        return BigDecimal.valueOf(crashMultiplier).setScale(2, RoundingMode.FLOOR);
    }

    /**
     * Derives deterministic Colour Prediction winning number (0-9).
     */
    public static int calculateColourNumber(String serverSeed, String clientSeed, long nonce) {
        String hmac = computeHmac(serverSeed, clientSeed, nonce);
        // Take first 8 hex chars and modulo 10
        long value = Long.parseLong(hmac.substring(0, 8), 16);
        return (int) (Math.abs(value) % 10);
    }

    /**
     * Resolves the primary and secondary colour from winning number (0-9).
     * 0 -> RED_VIOLET
     * 5 -> GREEN_VIOLET
     * 1, 3, 7, 9 -> GREEN
     * 2, 4, 6, 8 -> RED
     */
    public static String getWinningColor(int number) {
        return switch (number) {
            case 0 -> "RED_VIOLET";
            case 5 -> "GREEN_VIOLET";
            case 1, 3, 7, 9 -> "GREEN";
            case 2, 4, 6, 8 -> "RED";
            default -> "UNKNOWN";
        };
    }
}
