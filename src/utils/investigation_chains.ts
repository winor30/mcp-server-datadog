/**
 * Investigation chains for automated root cause analysis
 * These chains define structured sequences of Datadog API calls to investigate different types of issues
 */

/**
 * Step interface for investigation chain steps
 */
export interface InvestigationStep {
  name: string
  tool: string
  params: Record<string, unknown>
  outputs?: string[]
  conditional?: string
  description?: string
}

/**
 * Investigation chain interface
 */
export interface InvestigationChain {
  name: string
  description: string
  trigger: string
  steps: InvestigationStep[]
}

/**
 * Monitor Alert Investigation Chain
 * Used when investigating alerts from a specific monitor
 */
export const MONITOR_ALERT_CHAIN: InvestigationChain = {
  name: 'Monitor Alert Investigation',
  description: 'Investigates a triggered Datadog monitor alert',
  trigger: 'monitor_id',
  steps: [
    {
      name: 'Get Monitor Details',
      tool: 'get_monitors',
      params: { id: '{{monitor_id}}' },
      outputs: ['monitor_type', 'query', 'message', 'tags'],
      description:
        'Retrieves detailed information about the monitor that triggered',
    },
    {
      name: 'Get Recent Monitor Events',
      tool: 'get_monitor_event',
      params: {
        monitorId: '{{monitor_id}}',
        eventId: '{{most_recent_event_id}}',
      },
      description: 'Fetches the most recent event for this monitor',
    },
    {
      name: 'Check Related SLOs',
      tool: 'check_slos',
      params: {
        tags: '{{relevant_monitor_tags}}',
        timeframe: '7d',
      },
      description: 'Checks for SLOs that might be impacted by this alert',
    },
    {
      name: 'Analyze Error Patterns',
      tool: 'extract_error_signatures',
      params: {
        from: '{{alert_start_time - 300}}', // 5 minutes before alert
        to: '{{alert_time + 300}}', // 5 minutes after alert
        query: '{{derived_error_query}}',
        extract_stack_frames: 3,
      },
      description:
        'Identifies and groups error patterns during the alert period',
    },
    {
      name: 'Find Anomalous Log Patterns',
      tool: 'detect_anomalous_patterns',
      params: {
        from: '{{alert_start_time - 300}}',
        to: '{{alert_time + 300}}',
        baseline_from: '{{alert_start_time - 3600}}', // 1 hour before
        baseline_to: '{{alert_start_time - 300}}',
        query: '{{service_filter}}',
        sensitivity: 7,
      },
      description:
        'Detects unusual log patterns compared to the baseline period',
    },
    {
      name: 'Check Recent Deployments',
      tool: 'list_events',
      params: {
        start: '{{alert_start_time - 7200}}', // 2 hours before alert
        end: '{{alert_time}}',
        sources: ['deployment', 'release'],
        tags: '{{relevant_service_tags}}',
      },
      description:
        'Checks for deployments or releases that may have triggered the issue',
    },
    {
      name: 'Check Related Metrics',
      tool: 'query_metrics',
      params: {
        query: '{{derived_metrics_query}}',
        from: '{{alert_start_time - 3600}}', // 1 hour before
        to: '{{alert_time + 900}}', // 15 minutes after
      },
      description:
        'Examines related metrics to understand the impact and context',
    },
  ],
}

/**
 * Error Log Investigation Chain
 * Used when investigating a specific error log or pattern
 */
export const ERROR_LOG_CHAIN: InvestigationChain = {
  name: 'Error Log Investigation',
  description: 'Investigates a specific error log or error pattern',
  trigger: 'log_id or error_message',
  steps: [
    {
      name: 'Get Log Details',
      tool: 'get_logs',
      params: {
        id: '{{log_id}}',
        full: true,
      },
      outputs: ['timestamp', 'service', 'error_type'],
      description: 'Retrieves full details about the specific log',
    },
    {
      name: 'Find Similar Errors',
      tool: 'find_log_patterns',
      params: {
        from: '{{log_timestamp - 1800}}', // 30 minutes before
        to: '{{log_timestamp + 1800}}', // 30 minutes after
        query: 'status:error service:{{service}}',
        similarity_threshold: 0.7,
        min_occurrences: 2,
      },
      description: 'Finds similar error patterns around the time of this log',
    },
    {
      name: 'Extract Error Signature',
      tool: 'extract_error_signatures',
      params: {
        from: '{{log_timestamp - 1800}}',
        to: '{{log_timestamp + 1800}}',
        query: 'error_type:{{error_type}} service:{{service}}',
        group_by_location: true,
      },
      description:
        'Extracts and categorizes error signatures related to this error',
    },
    {
      name: 'Check for Related Traces',
      tool: 'list_traces',
      params: {
        query: 'error:true service:{{service}}',
        from: '{{log_timestamp - 900}}', // 15 minutes before
        to: '{{log_timestamp + 300}}', // 5 minutes after
      },
      description:
        'Finds APM traces related to this error for execution context',
    },
    {
      name: 'Check Monitor Status',
      tool: 'get_monitors',
      params: {
        tags: ['service:{{service}}'],
        groupStates: ['alert', 'warn'],
      },
      description: 'Checks if any monitors for this service are in alert state',
    },
    {
      name: 'Check Recent Deployments',
      tool: 'list_events',
      params: {
        start: '{{log_timestamp - 7200}}', // 2 hours before
        end: '{{log_timestamp}}',
        sources: ['deployment', 'release'],
        tags: ['service:{{service}}'],
      },
      description:
        'Checks for recent deployments that might have introduced this error',
    },
    {
      name: 'Check Service Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:{{service}}.error_rate{*} by {endpoint}, avg:{{service}}.request.duration{*} by {endpoint}',
        from: '{{log_timestamp - 3600}}',
        to: '{{log_timestamp + 900}}',
      },
      description: 'Examines service metrics around the time of the error',
    },
  ],
}

/**
 * Performance Regression Investigation Chain
 * Used when investigating performance degradations
 */
export const PERFORMANCE_REGRESSION_CHAIN: InvestigationChain = {
  name: 'Performance Regression Investigation',
  description: 'Investigates performance degradations or slowdowns',
  trigger: 'regression or slowdown keywords',
  steps: [
    {
      name: 'Check SLO Status',
      tool: 'list_slos',
      params: {
        timeframe: '7d',
        query: '{{service_filter}}',
      },
      outputs: ['at_risk_slos'],
      description: 'Identifies SLOs that are at risk or degraded',
    },
    {
      name: 'Analyze SLO History',
      tool: 'get_slo_history',
      conditional: '{{at_risk_slos.length > 0}}',
      params: {
        id: '{{at_risk_slos[0].id}}',
        from: '{{current_time - 86400}}', // 24 hours before
        to: '{{current_time}}',
        show_burn_rate: true,
      },
      description: 'Analyzes SLO history to understand the degradation pattern',
    },
    {
      name: 'Query Critical Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:service.request.duration{*} by {service}, avg:service.db.query.duration{*} by {service}, avg:service.error_rate{*} by {service}',
        from: '{{current_time - 86400}}', // 24 hours before
        to: '{{current_time}}',
      },
      description: 'Examines critical performance metrics across services',
    },
    {
      name: 'Detect Anomalous Log Patterns',
      tool: 'detect_anomalous_patterns',
      params: {
        from: '{{current_time - 21600}}', // Last 6 hours
        to: '{{current_time}}',
        baseline_from: '{{current_time - 86400}}', // 24-30 hours ago
        baseline_to: '{{current_time - 64800}}',
        query: '{{service_filter}}',
        sensitivity: 6,
      },
      description:
        'Identifies unusual log patterns that may explain the regression',
    },
    {
      name: 'List Recent Deployments',
      tool: 'list_events',
      params: {
        start: '{{current_time - 86400}}', // 24 hours before
        end: '{{current_time}}',
        sources: ['deployment', 'release', 'configuration'],
      },
      description:
        'Checks for deployments or configuration changes that might have caused regression',
    },
    {
      name: 'Check Database Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:postgresql.queries.duration{*}, max:postgresql.queries.count{*}, avg:mysql.performance.query_run_time.avg{*}',
        from: '{{current_time - 86400}}',
        to: '{{current_time}}',
      },
      description: 'Analyzes database performance metrics',
    },
    {
      name: 'Check Infrastructure Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:system.cpu.user{*} by {host}, avg:system.mem.used{*} by {host}, avg:system.io.await{*} by {host}',
        from: '{{current_time - 86400}}',
        to: '{{current_time}}',
      },
      description:
        'Examines infrastructure metrics that might affect performance',
    },
    {
      name: 'Check RUM Performance',
      tool: 'get_rum_page_performance',
      params: {
        query: '{{service_filter}}',
        from: '{{current_time - 86400}}',
        to: '{{current_time}}',
        metricNames: [
          'view.load_time',
          'view.first_contentful_paint',
          'view.largest_contentful_paint',
        ],
      },
      description:
        'Analyzes frontend performance metrics from real user monitoring',
    },
  ],
}

/**
 * New Error Type Investigation Chain
 * Used when investigating a newly detected error type
 */
export const NEW_ERROR_INVESTIGATION_CHAIN: InvestigationChain = {
  name: 'New Error Type Investigation',
  description: 'Investigates a newly detected error type',
  trigger: 'new error or new pattern keywords',
  steps: [
    {
      name: 'Extract Error Signatures',
      tool: 'extract_error_signatures',
      params: {
        from: '{{current_time - 14400}}', // Last 4 hours
        to: '{{current_time}}',
        query: 'status:error',
        group_by_location: true,
      },
      outputs: ['error_signatures'],
      description:
        'Identifies and categorizes error signatures to find the new error type',
    },
    {
      name: 'Find Historical Occurrences',
      tool: 'get_logs',
      params: {
        from: '{{current_time - 604800}}', // 7 days ago
        to: '{{current_time - 14400}}', // Up to 4 hours ago
        query: 'error_type:{{error_signatures[0].error_type}}',
        limit: 5,
      },
      description: 'Checks if this error has occurred previously',
    },
    {
      name: 'Find First Occurrence',
      tool: 'get_logs',
      params: {
        from: '{{current_time - 86400}}', // 24 hours ago
        to: '{{current_time}}',
        query: 'error_type:{{error_signatures[0].error_type}}',
        limit: 1,
        sort: 'timestamp', // Ascending to get first occurrence
      },
      description: 'Identifies the first occurrence of this new error type',
    },
    {
      name: 'Check Deployments Around First Occurrence',
      tool: 'list_events',
      params: {
        start: '{{first_occurrence_time - 1800}}', // 30 minutes before first occurrence
        end: '{{first_occurrence_time + 1800}}', // 30 minutes after
        sources: ['deployment', 'release'],
      },
      description:
        'Looks for deployments or releases around the time the error first appeared',
    },
    {
      name: 'Check Related Traces',
      tool: 'list_traces',
      params: {
        query: 'error:true service:{{affected_service}}',
        from: '{{first_occurrence_time - 300}}',
        to: '{{first_occurrence_time + 900}}',
      },
      description:
        'Finds APM traces to understand the execution context of the new error',
    },
    {
      name: 'Check Monitor Status Changes',
      tool: 'get_monitors',
      params: {
        tags: ['service:{{affected_service}}'],
        groupStates: ['alert', 'warn', 'no data'],
      },
      description:
        'Checks if any monitors have been triggered by this new error',
    },
  ],
}

/**
 * Service Dependency Investigation Chain
 * Used when investigating issues related to service dependencies
 */
export const SERVICE_DEPENDENCY_CHAIN: InvestigationChain = {
  name: 'Service Dependency Investigation',
  description: 'Investigates issues related to service dependencies',
  trigger: 'dependency or downstream or upstream keywords',
  steps: [
    {
      name: 'Check Primary Service Status',
      tool: 'query_metrics',
      params: {
        query:
          'avg:service.request.duration{service:{{primary_service}}}, sum:service.error_count{service:{{primary_service}}}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Examines the health of the primary service',
    },
    {
      name: 'Identify Dependencies from Traces',
      tool: 'list_traces',
      params: {
        query: 'service:{{primary_service}}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
        limit: 20,
      },
      outputs: ['dependency_services'],
      description: 'Identifies service dependencies from trace data',
    },
    {
      name: 'Check Dependency Health',
      tool: 'query_metrics',
      params: {
        query:
          'avg:service.request.duration{service:{{dependency_services}}}, sum:service.error_count{service:{{dependency_services}}}, avg:service.success_rate{service:{{dependency_services}}}',
        from: '{{current_time - 7200}}',
        to: '{{current_time}}',
      },
      description: 'Examines the health of dependent services',
    },
    {
      name: 'Check Database Connection Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:postgresql.connections{*}, avg:mysql.net.connections{*}, avg:redis.clients.connected{*}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description:
        'Checks database connection metrics that could affect service dependencies',
    },
    {
      name: 'Check External API Calls',
      tool: 'query_metrics',
      params: {
        query:
          'avg:http.request.duration{!service:*} by {url}, sum:http.request.errors{!service:*} by {url}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Examines performance of external API dependencies',
    },
    {
      name: 'Check Network Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:network.tcp.retransmit{*}, sum:aws.elb.httpcode_elb_5xx{*}, avg:network.http.request_time{*}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description:
        'Analyzes network metrics that could impact service communication',
    },
  ],
}

/**
 * Infrastructure Problem Investigation Chain
 * Used when investigating infrastructure-related issues
 */
export const INFRASTRUCTURE_INVESTIGATION_CHAIN: InvestigationChain = {
  name: 'Infrastructure Problem Investigation',
  description: 'Investigates infrastructure-related issues',
  trigger: 'infrastructure or hardware or capacity keywords',
  steps: [
    {
      name: 'Check Active Host Count',
      tool: 'get_active_hosts_count',
      params: { from: 3600 }, // Last hour
      description: 'Counts the number of active hosts',
    },
    {
      name: 'List Hosts With Issues',
      tool: 'list_hosts',
      params: {
        filter: 'status:alert OR status:warning',
      },
      description: 'Identifies hosts that are in alert or warning state',
    },
    {
      name: 'Check System Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:system.cpu.user{*} by {host}, avg:system.mem.used{*} by {host}, avg:system.io.await{*} by {host}, avg:system.load.norm.5{*} by {host}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Examines system-level metrics across hosts',
    },
    {
      name: 'Check Network Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:network.tcp.retransmit{*} by {host}, sum:network.tcp.refused{*} by {host}, avg:network.tcp.rtt{*} by {host}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Analyzes network performance metrics',
    },
    {
      name: 'Check Disk Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:system.disk.in_use{*} by {host,device}, avg:system.fs.inodes.in_use{*} by {host,device}, avg:system.io.r_s{*} by {host,device}, avg:system.io.w_s{*} by {host,device}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Examines disk usage and performance metrics',
    },
    {
      name: 'Check Container Metrics',
      tool: 'query_metrics',
      params: {
        query:
          'avg:docker.cpu.usage{*} by {container_name}, avg:docker.mem.in_use{*} by {container_name}, avg:kubernetes.cpu.usage.total{*} by {pod_name}, avg:kubernetes.memory.usage_pct{*} by {pod_name}',
        from: '{{current_time - 3600}}',
        to: '{{current_time}}',
      },
      description: 'Analyzes container and Kubernetes pod metrics',
    },
    {
      name: 'Check Auto-Scaling Events',
      tool: 'list_events',
      params: {
        start: '{{current_time - 10800}}', // 3 hours ago
        end: '{{current_time}}',
        sources: ['autoscaling'],
      },
      description:
        'Checks for auto-scaling events that might indicate capacity issues',
    },
    {
      name: 'Check Cloud Provider Events',
      tool: 'list_events',
      params: {
        start: '{{current_time - 10800}}', // 3 hours ago
        end: '{{current_time}}',
        sources: ['aws', 'gcp', 'azure'],
      },
      description:
        'Looks for cloud provider events that might impact infrastructure',
    },
  ],
}

/**
 * Map of all investigation chains for easy access
 */
export const INVESTIGATION_CHAINS: Record<string, InvestigationChain> = {
  monitor_alert: MONITOR_ALERT_CHAIN,
  error_log: ERROR_LOG_CHAIN,
  performance_regression: PERFORMANCE_REGRESSION_CHAIN,
  new_error: NEW_ERROR_INVESTIGATION_CHAIN,
  service_dependency: SERVICE_DEPENDENCY_CHAIN,
  infrastructure: INFRASTRUCTURE_INVESTIGATION_CHAIN,
}
