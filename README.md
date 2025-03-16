# Datadog MCP Server

![NPM Version](https://img.shields.io/npm/v/%40winor30%2Fmcp-server-datadog)![Build and Test](https://github.com/winor30/mcp-server-datadog/actions/workflows/ci.yml/badge.svg)[![codecov](https://codecov.io/gh/winor30/mcp-server-datadog/graph/badge.svg?token=BG4ZB74X92)](https://codecov.io/gh/winor30/mcp-server-datadog)[![smithery badge](https://smithery.ai/badge/@winor30/mcp-server-datadog)](https://smithery.ai/server/@winor30/mcp-server-datadog)

MCP server for the Datadog API, enabling incident management and more.

<a href="https://glama.ai/mcp/servers/bu8gtzkwfr">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/bu8gtzkwfr/badge" alt="mcp-server-datadog MCP server" />
</a>

## Features

- **Observability Tools**: Provides a mechanism to leverage key Datadog monitoring features, such as incidents, monitors, logs, dashboards, and metrics, through the MCP server.
- **Extensible Design**: Designed to easily integrate with additional Datadog APIs, allowing for seamless future feature expansion.

## Tools

1. `list_incidents`

   - Retrieve a list of incidents from Datadog.
   - **Inputs**:
     - `filter` (optional string): Filter parameters for incidents (e.g., status, priority).
     - `pagination` (optional object): Pagination details like page size/offset.
   - **Returns**: Array of Datadog incidents and associated metadata.

2. `get_incident`

   - Retrieve detailed information about a specific Datadog incident.
   - **Inputs**:
     - `incident_id` (string): Incident ID to fetch details for.
   - **Returns**: Detailed incident information (title, status, timestamps, etc.).

3. `get_monitors`

   - Fetch the status of Datadog monitors.
   - **Inputs**:
     - `groupStates` (optional array): States to filter (e.g., alert, warn, no data, ok).
     - `name` (optional string): Filter by name.
     - `tags` (optional array): Filter by tags.
   - **Returns**: Monitors data and a summary of their statuses.

4. `get_logs`

   - Search and retrieve logs from Datadog.
   - **Inputs**:
     - `query` (string): Datadog logs query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
     - `limit` (optional number): Maximum number of logs to return (defaults to 100).
   - **Returns**: Array of matching logs.

5. `list_dashboards`

   - Get a list of dashboards from Datadog.
   - **Inputs**:
     - `name` (optional string): Filter dashboards by name.
     - `tags` (optional array): Filter dashboards by tags.
   - **Returns**: Array of dashboards with URL references.

6. `get_metrics`

   - Retrieve metrics data from Datadog.
   - **Inputs**:
     - `query` (string): Metrics query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
   - **Returns**: Metrics data for the queried timeframe.

7. `list_traces`

   - Retrieve a list of APM traces from Datadog.
   - **Inputs**:
     - `query` (string): Datadog APM trace query string.
     - `from` (number): Start time in epoch seconds.
     - `to` (number): End time in epoch seconds.
     - `limit` (optional number): Maximum number of traces to return (defaults to 100).
     - `sort` (optional string): Sort order for traces (defaults to '-timestamp').
     - `service` (optional string): Filter by service name.
     - `operation` (optional string): Filter by operation name.
   - **Returns**: Array of matching traces from Datadog APM.

8. `list_hosts`

   - Get list of hosts from Datadog.
   - **Inputs**:
     - `filter` (optional string): Filter string for search results.
     - `sort_field` (optional string): Field to sort hosts by.
     - `sort_dir` (optional string): Sort direction (asc/desc).
     - `start` (optional number): Starting offset for pagination.
     - `count` (optional number): Max number of hosts to return (max: 1000).
     - `from` (optional number): Search hosts from this UNIX timestamp.
     - `include_muted_hosts_data` (optional boolean): Include muted hosts status and expiry.
     - `include_hosts_metadata` (optional boolean): Include host metadata (version, platform, etc).
   - **Returns**: Array of hosts with details including name, ID, aliases, apps, mute status, and more.

9. `get_active_hosts_count`

   - Get the total number of active hosts in Datadog.
   - **Inputs**:
     - `from` (optional number): Number of seconds from which you want to get total number of active hosts (defaults to 2h).
   - **Returns**: Count of total active and up hosts.

10. `mute_host`

    - Mute a host in Datadog.
    - **Inputs**:
      - `hostname` (string): The name of the host to mute.
      - `message` (optional string): Message to associate with the muting of this host.
      - `end` (optional number): POSIX timestamp for when the mute should end.
      - `override` (optional boolean): If true and the host is already muted, replaces existing end time.
    - **Returns**: Success status and confirmation message.

11. `unmute_host`

    - Unmute a host in Datadog.
    - **Inputs**:
      - `hostname` (string): The name of the host to unmute.
    - **Returns**: Success status and confirmation message.

12. `list_downtimes`

    - List scheduled downtimes from Datadog.
    - **Inputs**:
      - `currentOnly` (optional boolean): Return only currently active downtimes when true.
      - `monitorId` (optional number): Filter by monitor ID.
    - **Returns**: Array of scheduled downtimes with details including scope, monitor information, and schedule.

13. `schedule_downtime`

    - Schedule a downtime in Datadog.
    - **Inputs**:
      - `scope` (string): Scope to apply downtime to (e.g. 'host:my-host').
      - `start` (optional number): UNIX timestamp for the start of the downtime.
      - `end` (optional number): UNIX timestamp for the end of the downtime.
      - `message` (optional string): A message to include with the downtime.
      - `timezone` (optional string): The timezone for the downtime (e.g. 'UTC', 'America/New_York').
      - `monitorId` (optional number): The ID of the monitor to mute.
      - `monitorTags` (optional array): A list of monitor tags for filtering.
      - `recurrence` (optional object): Recurrence settings for the downtime.
        - `type` (string): Recurrence type ('days', 'weeks', 'months', 'years').
        - `period` (number): How often to repeat (must be >= 1).
        - `weekDays` (optional array): Days of the week for weekly recurrence.
        - `until` (optional number): UNIX timestamp for when the recurrence ends.
    - **Returns**: Scheduled downtime details including ID and active status.

14. `cancel_downtime`
    - Cancel a scheduled downtime in Datadog.
    - **Inputs**:
      - `downtimeId` (number): The ID of the downtime to cancel.
    - **Returns**: Confirmation of downtime cancellation.

## Setup

### Datadog Credentials

You need valid Datadog API credentials to use this MCP server:

- `DATADOG_API_KEY`: Your Datadog API key
- `DATADOG_APP_KEY`: Your Datadog Application key
- `DATADOG_SITE` (optional): The Datadog site (e.g. `datadoghq.eu`)

Export them in your environment before running the server:

```bash
export DATADOG_API_KEY="your_api_key"
export DATADOG_APP_KEY="your_app_key"
export DATADOG_SITE="your_datadog_site"
```

## Installation

### Installing via Smithery

To install Datadog MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@winor30/mcp-server-datadog):

```bash
npx -y @smithery/cli install @winor30/mcp-server-datadog --client claude
```

### Manual Installation

```bash
pnpm install
pnpm build
pnpm watch   # for development with auto-rebuild
```

## Usage with Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json`:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

```json
{
  "mcpServers": {
    "datadog": {
      "command": "/path/to/mcp-server-datadog/build/index.js",
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>" // Optional
      }
    }
  }
}
```

Or specify via `npx`:

```json
{
  "mcpServers": {
    "mcp-server-datadog": {
      "command": "npx",
      "args": ["-y", "@winor30/mcp-server-datadog"],
      "env": {
        "DATADOG_API_KEY": "<YOUR_API_KEY>",
        "DATADOG_APP_KEY": "<YOUR_APP_KEY>",
        "DATADOG_SITE": "<YOUR_SITE>" // Optional
      }
    }
  }
}
```

## Debugging

Because MCP servers communicate over standard input/output, debugging can sometimes be tricky. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). You can run the inspector with:

```bash
npm run inspector
```

The inspector will provide a URL you can open in your browser to see logs and send requests manually.

## Contributing

Contributions are welcome! Feel free to open an issue or a pull request if you have any suggestions, bug reports, or improvements to propose.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).
