/* AIOS bootstrap — import this to use the gateway; it guarantees the built-in
 * capability providers are registered before execute() runs. */
import "./providers"

export { execute, registerProvider, providerKeys } from "./execute"
export type { ExecCtx, ExecResult, Provider, ProviderResult } from "./execute"
export { emit, on, drain, process as processEvent } from "./events"
export { writeAiRun, inputsHash } from "./audit"
export { getCapability, getModel, getAgent, clearRegistryCache, MODELS, CAPABILITIES, AGENTS } from "./registry"
