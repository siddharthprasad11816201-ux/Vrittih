/* AIOS bootstrap — import this to use the gateway; it guarantees the built-in
 * capability providers + knowledge event handlers are registered before use. */
import "./providers"
import { registerKnowledgeHandlers } from "@/lib/knowledge/handlers"
registerKnowledgeHandlers()

export { execute, registerProvider, providerKeys } from "./execute"
export type { ExecCtx, ExecResult, Provider, ProviderResult } from "./execute"
export { emit, on, drain, process as processEvent } from "./events"
export { writeAiRun, inputsHash } from "./audit"
export { getCapability, getModel, getAgent, clearRegistryCache, MODELS, CAPABILITIES, AGENTS } from "./registry"
