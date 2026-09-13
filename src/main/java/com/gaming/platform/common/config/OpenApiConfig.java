package com.gaming.platform.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Antigravity Real-Money Gaming (RMG) Enterprise API")
                        .description("Legally compliant Real-Money Gaming platform API with double-entry ledger accounting, " +
                                "manual WhatsApp payment verification, provably fair games (Ludo, Aviator, Colour Prediction), " +
                                "AML transaction monitoring, and responsible gaming tools.")
                        .version("1.0.0")
                        .contact(new Contact().name("RMG Architecture Team").email("compliance@rmgplatform.com"))
                        .license(new License().name("Proprietary - Licensed Gaming Operator Only")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter JWT Bearer token obtained from /api/auth/login or /api/auth/register")));
    }
}
