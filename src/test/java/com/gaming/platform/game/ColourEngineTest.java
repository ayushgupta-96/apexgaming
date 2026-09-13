package com.gaming.platform.game;

import com.gaming.platform.common.util.ProvablyFairUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ColourEngineTest {

    @Test
    @DisplayName("Colour Prediction: Number (0-9) generation must be deterministic and within range")
    void testColourNumberGeneration() {
        String serverSeed = ProvablyFairUtil.generateServerSeed();
        String clientSeed = "client-seed-123";
        long nonce = 100L;

        int num1 = ProvablyFairUtil.calculateColourNumber(serverSeed, clientSeed, nonce);
        int num2 = ProvablyFairUtil.calculateColourNumber(serverSeed, clientSeed, nonce);

        assertEquals(num1, num2);
        assertTrue(num1 >= 0 && num1 <= 9);
    }

    @Test
    @DisplayName("Colour Prediction: Color resolution mapping checks")
    void testColorResolutionMapping() {
        assertEquals("RED_VIOLET", ProvablyFairUtil.getWinningColor(0));
        assertEquals("GREEN_VIOLET", ProvablyFairUtil.getWinningColor(5));
        assertEquals("GREEN", ProvablyFairUtil.getWinningColor(1));
        assertEquals("RED", ProvablyFairUtil.getWinningColor(2));
        assertEquals("GREEN", ProvablyFairUtil.getWinningColor(3));
        assertEquals("RED", ProvablyFairUtil.getWinningColor(4));
        assertEquals("RED", ProvablyFairUtil.getWinningColor(6));
        assertEquals("GREEN", ProvablyFairUtil.getWinningColor(7));
        assertEquals("RED", ProvablyFairUtil.getWinningColor(8));
        assertEquals("GREEN", ProvablyFairUtil.getWinningColor(9));
    }
}
