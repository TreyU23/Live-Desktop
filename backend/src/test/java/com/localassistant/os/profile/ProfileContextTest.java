package com.localassistant.os.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProfileContextTest {
    @Test
    void acceptsTheDefaultAndUiMadeIds() {
        assertThat(ProfileContext.parse(null)).contains("default");
        assertThat(ProfileContext.parse(" ")).contains("default");
        assertThat(ProfileContext.parse("default")).contains("default");
        assertThat(ProfileContext.parse("3F2504E0_4F89_41D3_9A0C_0305E82C3301")).contains("3f2504e0_4f89_41d3_9a0c_0305e82c3301");
    }

    @Test
    void refusesAnythingElse() {
        for (String bad : new String[] {"..", "test_abc", "3f2504e0-4f89-41d3-9a0c-0305e82c3301", "a".repeat(80), "default/../x"}) {
            assertThat(ProfileContext.parse(bad)).as(bad).isEmpty();
        }
        assertThatThrownBy(() -> ProfileContext.set("nope")).isInstanceOf(IllegalArgumentException.class);
        ProfileContext.clear();
    }
}
