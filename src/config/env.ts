import { z } from "zod";

const envSchema = z
  .object({
    PROVIDER: z.enum(["openrouter", "opencode-go"]).default("openrouter"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENCODE_API_KEY: z.string().optional(),
    MODEL: z.string().default("google/gemini-2.5-flash"),
    GRADER_MODEL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const key = env.PROVIDER === "opencode-go" ? "OPENCODE_API_KEY" : "OPENROUTER_API_KEY";
    if (!env[key]) {
      ctx.addIssue({ code: "custom", path: [key], message: `${key} is required for PROVIDER=${env.PROVIDER}` });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (_config) return _config;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Error: Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): EnvConfig {
  if (!_config) return loadConfig();
  return _config;
}
