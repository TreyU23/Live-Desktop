package com.localassistant.os.agent;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.error.ClientErrors;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfileLifecycle;
import com.localassistant.os.service.DashboardContextService;
import com.openai.client.OpenAIClient;
import com.openai.core.RequestOptions;
import com.openai.errors.OpenAIIoException;
import com.openai.errors.OpenAIServiceException;
import com.openai.models.Reasoning;
import com.openai.models.ReasoningEffort;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseFunctionToolCall;
import com.openai.models.responses.ResponseIncludable;
import com.openai.models.responses.ResponseInputItem;
import com.openai.models.responses.ResponseOutputItem;
import com.openai.models.responses.ResponseStatus;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Runs one chat turn against the OpenAI Responses API. */
@Component
public class OpenAiAgent {
    private final AssistantProperties properties;
    private final DashboardContextService dashboardContext;
    private final AssistantToolRunner tools;
    private final ProfileClientPool clients;

    public OpenAiAgent(
            AssistantProperties properties,
            DashboardContextService dashboardContext,
            AssistantToolRunner tools,
            ProfileClientPool clients) {
        this.properties = properties;
        this.dashboardContext = dashboardContext;
        this.tools = tools;
        this.clients = clients;
    }

    public String model() {
        return properties.getOpenaiModel();
    }

    /**
     * One model call. Each attempt may use all the time left, and only a failure that happened quickly
     * (connection error, retryable status) is retried; a client-side timeout is not, because the
     * abandoned call may still be generated and billed (issue #49).
     */
    private Response create(OpenAIClient client, ResponseCreateParams params, long deadline) {
        for (int attempt = 1; ; attempt++) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) throw new AssistantAgent.AgentDeadlineException();
            RequestOptions options = RequestOptions.builder().timeout(Duration.ofNanos(remaining)).build();
            // Don't hold the profile lease across the network call; a profile deletion
            // would otherwise queue behind it and stall every later request (issue #6).
            try (var suspended = ProfileLifecycle.suspend()) {
                return client.responses().create(params, options);
            } catch (RuntimeException error) {
                // A deletion during the call must not be reported as a timeout or any other error.
                ProfileLifecycle.rethrowIfDeleted(error);
                if (System.nanoTime() >= deadline) throw new AssistantAgent.AgentDeadlineException();
                if (attempt >= AssistantAgent.MODEL_CALL_ATTEMPTS || !retryable(error)) throw error;
                AssistantAgent.pauseBeforeRetry(deadline);
            }
        }
    }

    static boolean retryable(RuntimeException error) {
        if (error instanceof OpenAIServiceException service) {
            return AssistantAgent.RETRYABLE_STATUS.contains(service.statusCode());
        }
        if (!(error instanceof OpenAIIoException)) return false;
        // A timeout surfaces as an I/O error; it is not retried (see create).
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof java.io.InterruptedIOException) return false;
        }
        return true;
    }

    String reply(Conversation conversation, String key, long deadline) throws IOException {
        try (var lease = clients.acquire(ProfileContext.currentId(), key)) {
            OpenAIClient client = lease.client();

            List<ResponseInputItem> inputs = new ArrayList<>();
            for (String text : AgentPrompt.userInputs(conversation, dashboardContext)) {
                inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                        .addInputTextContent(text)
                        .role(ResponseInputItem.Message.Role.USER)
                        .build()));
            }

            ResponseCreateParams.Builder builder = ResponseCreateParams.builder()
                    .model(properties.getOpenaiModel())
                    .instructions(AgentPrompt.SYSTEM_PROMPT)
                    .reasoning(Reasoning.builder()
                            .effort(ReasoningEffort.of(properties.getReasoningEffort()))
                            .build())
                    // With store=false the model's reasoning is only kept if it is sent back, encrypted, between rounds.
                    .addInclude(ResponseIncludable.REASONING_ENCRYPTED_CONTENT)
                    .store(false);
            for (Class<?> tool : AssistantToolRunner.TOOLS) builder.addTool(tool);

            for (int turn = 0; turn < AssistantAgent.MAX_MODEL_TURNS; turn++) {
                ResponseCreateParams params = builder.input(ResponseCreateParams.Input.ofResponse(inputs)).build();
                Response response = create(client, params, deadline);
                // A reply that stopped early (status incomplete) may hold a tool call with cut-off arguments;
                // never run those (issue #44, as for Anthropic in #28).
                boolean incomplete = response.status().filter(ResponseStatus.INCOMPLETE::equals).isPresent();
                boolean outputLimit = incomplete && response.incompleteDetails()
                        .flatMap(Response.IncompleteDetails::reason)
                        .filter(Response.IncompleteDetails.Reason.MAX_OUTPUT_TOKENS::equals).isPresent();

                if (incomplete || response.output().stream().noneMatch(item -> item.isFunctionCall())) {
                    String text = response.output().stream()
                            .flatMap(item -> item.message().stream())
                            .flatMap(message -> message.content().stream())
                            .flatMap(content -> content.outputText().stream())
                            .map(output -> output.text())
                            .reduce("", String::concat);
                    if (outputLimit) {
                        return text.isBlank()
                                ? AssistantAgent.kTruncatedWithoutText
                                : text.stripTrailing() + "\n\n" + AssistantAgent.kTruncatedNote;
                    }
                    return text.isBlank() ? "I could not produce a text response." : text;
                }

                // Send the reasoning back with the calls it led to, in the order the model produced them.
                for (ResponseOutputItem item : response.output()) {
                    if (item.isReasoning()) {
                        inputs.add(ResponseInputItem.ofReasoning(item.asReasoning()));
                        continue;
                    }
                    if (!item.isFunctionCall()) continue;
                    ResponseFunctionToolCall call = item.asFunctionCall();
                    inputs.add(ResponseInputItem.ofFunctionCall(call));
                    Object output;
                    try {
                        output = tools.run(call.name(), call.arguments());
                    } catch (Exception error) {
                        output = Map.of("error", ClientErrors.message(error));
                    }
                    inputs.add(ResponseInputItem.ofFunctionCallOutput(
                            ResponseInputItem.FunctionCallOutput.builder()
                                    .callId(call.callId())
                                    .outputAsJson(output)
                                    .build()));
                }
            }
            throw new IllegalStateException("The assistant exceeded the tool-call limit for one request.");
        }
    }
}
