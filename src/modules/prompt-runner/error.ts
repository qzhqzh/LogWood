export class PromptRunnerError extends Error {
  constructor(
    public readonly code:
      | 'ERR_PROMPT_RUNNER_NOT_CONFIGURED'
      | 'ERR_PROMPT_RUNNER_AUTH'
      | 'ERR_PROMPT_RUNNER_UNAVAILABLE'
      | 'ERR_PROMPT_RUNNER_INVALID_RESPONSE'
      | 'ERR_PROMPT_RUNNER_CANCELLED',
    public readonly retryable: boolean,
  ) {
    super(code)
    this.name = 'PromptRunnerError'
  }
}
