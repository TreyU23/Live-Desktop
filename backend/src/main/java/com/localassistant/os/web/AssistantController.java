package com.localassistant.os.web;

import com.localassistant.os.agent.OpenAiAgent;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.service.ActionService;
import com.localassistant.os.service.MemoryService;
import com.localassistant.os.service.ProfileCredentialStore;
import com.localassistant.os.service.ProfileDataService;
import com.localassistant.os.service.RuntimeService;
import com.localassistant.os.service.ICloudCalendarService;
import com.localassistant.os.service.WorkspaceService;
import com.localassistant.os.service.SystemService;
import com.localassistant.os.service.WindowsMediaSessionService;
import com.localassistant.os.store.StateStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AssistantController {
    private final StateStore store;
    private final OpenAiAgent agent;
    private final ActionService actions;
    private final MemoryService memories;
    private final WorkspaceService workspace;
    private final SystemService system;
    private final RuntimeService runtime;
    private final ICloudCalendarService iCloudCalendar;
    private final WindowsMediaSessionService mediaSession;
    private final ProfileCredentialStore profileCredentials;
    private final ProfileDataService profileData;

    public AssistantController(
            StateStore store,
            OpenAiAgent agent,
            ActionService actions,
            MemoryService memories,
            WorkspaceService workspace,
            SystemService system,
            RuntimeService runtime,
            ICloudCalendarService iCloudCalendar,
            WindowsMediaSessionService mediaSession,
            ProfileCredentialStore profileCredentials,
            ProfileDataService profileData) {
        this.store = store;
        this.agent = agent;
        this.actions = actions;
        this.memories = memories;
        this.workspace = workspace;
        this.system = system;
        this.runtime = runtime;
        this.iCloudCalendar = iCloudCalendar;
        this.mediaSession = mediaSession;
        this.profileCredentials = profileCredentials;
        this.profileData = profileData;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "openAiConfigured", agent.configured(),
                "workspaceRoot", workspace.root().toString());
    }

    @GetMapping("/api/profile/settings")
    public Map<String, Object> profileSettings() {
        return Map.of("openAiConfigured", agent.configured(), "profileApiKey", agent.profileKeyConfigured());
    }

    @PostMapping("/api/profile/openai-key")
    public ResponseEntity<?> saveProfileOpenAiKey(@RequestBody OpenAiKeyRequest request) {
        try {
            profileCredentials.saveOpenAiKey(request.apiKey());
            return ResponseEntity.ok(Map.of("openAiConfigured", true, "profileApiKey", true));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @DeleteMapping("/api/profile/openai-key")
    public ResponseEntity<?> deleteProfileOpenAiKey() {
        try {
            profileCredentials.clearOpenAiKey();
            return ResponseEntity.ok(Map.of("openAiConfigured", agent.configured(), "profileApiKey", false));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @DeleteMapping("/api/profile/data")
    public ResponseEntity<?> deleteProfileData() {
        try {
            profileData.deleteCurrent();
            return ResponseEntity.noContent().build();
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @GetMapping("/api/conversations")
    public Object conversations() {
        return store.snapshot().conversations().stream()
                .map(conversation -> Map.of(
                        "id", conversation.id(),
                        "title", conversation.title(),
                        "createdAt", conversation.createdAt(),
                        "updatedAt", conversation.updatedAt(),
                        "messageCount", conversation.messages().size()))
                .toList();
    }

    @GetMapping("/api/conversations/{id}")
    public ResponseEntity<?> conversation(@PathVariable String id) {
        return store.snapshot().conversations().stream()
                .filter(item -> item.id().equals(id))
                .findFirst()
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Conversation not found.")));
    }

    @PostMapping("/api/chat")
    public ResponseEntity<?> chat(@Valid @RequestBody ChatRequest request) {
        if (!agent.configured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "OPENAI_API_KEY is not configured."));
        }
        try {
            Conversation conversation = store.getOrCreateConversation(request.conversationId());
            store.addMessage(conversation.id(), "user", request.message().trim());
            Conversation current = store.snapshot().conversations().stream()
                    .filter(item -> item.id().equals(conversation.id()))
                    .findFirst()
                    .orElseThrow();
            ConversationMessage message = store.addMessage(
                    conversation.id(), "assistant", agent.reply(current));
            return ResponseEntity.ok(Map.of("conversationId", conversation.id(), "message", message));
        } catch (Exception error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error(error));
        }
    }

    @GetMapping("/api/actions")
    public Object actions(@RequestParam(required = false) String status) {
        return actions.list(status);
    }

    @PostMapping("/api/actions/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id) {
        try {
            return ResponseEntity.ok(actions.approve(id));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @PostMapping("/api/actions/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable String id) {
        try {
            return ResponseEntity.ok(actions.reject(id));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @GetMapping("/api/memories")
    public Object memories() {
        return memories.list();
    }

    @GetMapping("/api/system")
    public Object system() {
        return system.snapshot();
    }

    @GetMapping("/api/system/apps")
    public Object runningApps() {
        return system.runningApps();
    }

    @GetMapping("/api/runtime")
    public Object runtime() {
        return runtime.status();
    }

    @PostMapping("/api/runtime/{action}")
    public ResponseEntity<?> lifecycle(@PathVariable String action) {
        try {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(runtime.request(action));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @GetMapping("/api/integrations/phone-link")
    public Object phoneLink() {
        return system.phoneLink();
    }

    @PostMapping("/api/system/controls/{id}")
    public ResponseEntity<?> openSystemControl(
            @PathVariable String id,
            @RequestBody(required = false) SystemControlRequest request) {
        try {
            var control = system.control(id);
            var action = control.direct()
                    ? proposeDirectSystemControl(control, request)
                    : actions.propose(
                            "windows_open_uri",
                            Map.of("uri", control.settingsUri()),
                            "Open Windows " + control.label() + " settings.");
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(action);
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    private Object proposeDirectSystemControl(
            SystemService.ControlDefinition control,
            SystemControlRequest request) throws IOException {
        if (request == null || request.enabled() == null) {
            throw new IllegalArgumentException("enabled is required for direct Windows controls.");
        }
        boolean enabled = request.enabled();
        return actions.propose(
                "windows_set_control",
                Map.of("control", control.id(), "enabled", enabled),
                "Turn " + control.label() + " " + (enabled ? "on" : "off") + ".");
    }

    @PostMapping("/api/integrations/phone-link/open")
    public ResponseEntity<?> openPhoneLink() {
        try {
            var phone = system.phoneLink();
            if (!phone.installed()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Microsoft Phone Link is not installed."));
            }
            var action = actions.propose(
                    "windows_open_uri",
                    Map.of("uri", phone.uri()),
                    "Open Microsoft Phone Link.");
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(action);
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @GetMapping("/api/integrations/icloud-calendar")
    public Object iCloudCalendar(
            @RequestParam(required = false) LocalDate date,
            @RequestParam(required = false) Long refresh) {
        return iCloudCalendar.snapshot(date == null ? LocalDate.now() : date, refresh != null);
    }

    @PostMapping("/api/integrations/icloud-calendar/connect")
    public ResponseEntity<?> connectICloudCalendar(@RequestBody ICloudCalendarRequest request) {
        try {
            return ResponseEntity.ok(iCloudCalendar.connect(request.email(), request.appSpecificPassword()));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @DeleteMapping("/api/integrations/icloud-calendar")
    public ResponseEntity<?> disconnectICloudCalendar() {
        try {
            return ResponseEntity.ok(iCloudCalendar.disconnect());
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @GetMapping("/api/integrations/media-session")
    public Object mediaSession(@RequestParam(required = false, defaultValue = "music") String provider) {
        return mediaSession.snapshot(provider);
    }

    @PostMapping("/api/integrations/media-session/{action}")
    public ResponseEntity<?> controlMediaSession(
            @PathVariable String action,
            @RequestParam(required = false, defaultValue = "music") String provider) {
        try {
            return ResponseEntity.ok(mediaSession.control(action, provider));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @PostMapping("/api/memories")
    public ResponseEntity<?> createMemory(@RequestBody MemoryRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(memories.add(request.content(), request.category()));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(error(error));
        }
    }

    @DeleteMapping("/api/memories/{id}")
    public ResponseEntity<?> deleteMemory(@PathVariable String id) throws IOException {
        return memories.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Memory not found."));
    }

    private Map<String, String> error(Exception error) {
        String message = error.getMessage() == null ? error.toString() : error.getMessage();
        return Map.of("error", message);
    }

    public record ChatRequest(
            String conversationId,
            @NotBlank @Size(max = 20_000) String message) {}

    public record MemoryRequest(String content, String category) {}

    public record ICloudCalendarRequest(String email, String appSpecificPassword) {}
    public record OpenAiKeyRequest(String apiKey) {}
    public record SystemControlRequest(Boolean enabled) {}

}
