// Secrets are not declared in wrangler.jsonc, so `wrangler types` cannot emit
// them; only an interface merges into the generated Env.
// biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging needs an interface
interface Env {
  TYPESAFE_API_KEY: string;
}
