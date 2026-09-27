package com.localassistant.os.agent;

import com.fasterxml.jackson.annotation.JsonClassDescription;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.fasterxml.jackson.annotation.JsonTypeName;
import java.util.List;

public final class AssistantTools {
    private AssistantTools() {}

    @JsonTypeName("list_workspace_files")
    @JsonClassDescription("Lists files inside the configured project workspace. This is read-only.")
    public static class ListWorkspaceFiles {
        @JsonPropertyDescription("Workspace-relative directory, or . for the root.")
        public String subdirectory;
        @JsonPropertyDescription("Maximum number of files from 1 to 500.")
        public int limit;
    }

    @JsonTypeName("read_workspace_file")
    @JsonClassDescription("Reads a UTF-8 text file of at most 100 KB from inside the workspace.")
    public static class ReadWorkspaceFile {
        public String path;
    }

    @JsonTypeName("recall_memory")
    @JsonClassDescription("Searches memories the user previously chose to store.")
    public static class RecallMemory {
        public String query;
        public int limit;
    }

    @JsonTypeName("get_dashboard_context")
    @JsonClassDescription("Returns a compact live subset of the dashboard. Request only topics needed for the user's question. Valid topics: system, apps, phone, calendar, music, runtime, approvals, summary. Never request unrelated topics.")
    public static class GetDashboardContext {
        @JsonPropertyDescription("One to four relevant dashboard topics.")
        public List<String> topics;
        @JsonPropertyDescription("Optional calendar date in YYYY-MM-DD format; only relevant with the calendar topic.")
        public String date;
    }

    @JsonTypeName("propose_write_file")
    @JsonClassDescription("Requests a workspace file write. The first write to a file waits for user approval; later writes to that approved file run immediately.")
    public static class ProposeWriteFile {
        public String path;
        public String content;
        public String reason;
    }

    @JsonTypeName("propose_open_url")
    @JsonClassDescription("Requests opening an HTTP or HTTPS URL in the Windows browser. The first request for that URL waits for approval; later matching requests run immediately.")
    public static class ProposeOpenUrl {
        public String url;
        public String reason;
    }

    @JsonTypeName("propose_memory")
    @JsonClassDescription("Requests a useful durable memory. The first memory in a category waits for approval; later memories in that approved category are saved immediately.")
    public static class ProposeMemory {
        public String content;
        @JsonPropertyDescription("One of preference, project, fact, or instruction.")
        public String category;
        public String reason;
    }
}
