package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** The phone battery is read from Phone Link's Adaptive Card, not from any "NN%" text (issue #46). */
class SystemServicePhoneBatteryTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Trimmed to the shape Phone Link writes; every value here is made up.
    private static final String BATTERY_CONTAINER = """
        {"type":"ColumnSet","columns":[
          {"type":"Column","width":"auto","items":[
            {"type":"Container","tooltip":"Battery 78% remaining","items":[
              {"type":"TextBlock","text":"78%","size":"small"}]}]}]}
        """;

    private static final String MESSAGE_PREVIEW = """
        {"type":"Container","items":[{"type":"Container","preview":{"type":"AdaptiveCard","body":[
          {"type":"ColumnSet","columns":[{"type":"Column","items":[
            {"type":"TextBlock","text":"50%","wrap":true}]}]}]}}]}
        """;

    private static Optional<Integer> read(String json) throws Exception {
        JsonNode node = MAPPER.readTree(json);
        return SystemService.batteryPercent(node);
    }

    @Test
    void readsTheBatteryContainerOfTheCard() throws Exception {
        assertThat(read("{\"body\":[" + BATTERY_CONTAINER + "]}")).contains(78);
    }

    @Test
    void aPercentageInANotificationPreviewIsNeverTheBattery() throws Exception {
        assertThat(read("{\"body\":[" + MESSAGE_PREVIEW + "," + BATTERY_CONTAINER + "]}")).contains(78);
        assertThat(read("{\"body\":[" + MESSAGE_PREVIEW + "]}")).isEmpty();
    }

    @Test
    void aBareTextBlockOrAMismatchedTooltipIsNotEnough() throws Exception {
        assertThat(read("{\"body\":[{\"type\":\"TextBlock\",\"text\":\"50%\"}]}")).isEmpty();
        assertThat(read("{\"body\":[{\"tooltip\":\"Battery 78% remaining\",\"items\":[{\"text\":\"50%\"}]}]}")).isEmpty();
        assertThat(read("{\"body\":[{\"tooltip\":\"Battery 250% remaining\",\"items\":[{\"text\":\"250%\"}]}]}")).isEmpty();
    }

    @Test
    void emptyOrUnrelatedFilesAreUnavailable() throws Exception {
        assertThat(read("{}")).isEmpty();
        assertThat(read("[]")).isEmpty();
        assertThat(read("{\"battery\":\"20%\"}")).isEmpty();
    }
}
