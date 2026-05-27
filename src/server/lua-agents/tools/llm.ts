// LLM tools for the Lua agent sandbox.
// Uses fetch directly to the OpenAI API — no SDK dependency required.
// Model aliases map Lua-friendly names to actual model IDs.

const MODEL_MAP: Record<string, string> = {
  haiku:   'gpt-4o-mini',
  sonnet:  'gpt-4o',
  opus:    'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
}

type LlmModel = keyof typeof MODEL_MAP

async function openaiChat(
  prompt: string,
  model: LlmModel,
  system: string,
  jsonMode: boolean,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const modelId = MODEL_MAP[model] ?? 'gpt-4o-mini'

  const body: Record<string, unknown> = {
    model: modelId,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`OpenAI ${res.status}: ${JSON.stringify(err.error ?? err)}`)
  }

  const result = await res.json() as { choices: Array<{ message: { content: string } }> }
  return result.choices[0]?.message?.content?.trim() ?? ''
}

export const llmTools = {
  'llm.call': async (
    prompt: string,
    model: LlmModel = 'haiku',
    system = 'You are a helpful music industry assistant for MixHive.',
  ): Promise<string> => {
    return openaiChat(prompt, model, system, false)
  },

  'llm.json': async (
    prompt: string,
    schemaDesc: string,
    model: LlmModel = 'haiku',
  ): Promise<Record<string, unknown>> => {
    const system = `You are a JSON-only response assistant. Return ONLY valid JSON matching this schema description: ${schemaDesc}. No markdown, no backticks, no explanation.`
    const raw = await openaiChat(prompt, model, system, true)
    try {
      return JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      throw new Error(`llm.json parse failed — raw: ${raw.slice(0, 200)}`)
    }
  },
}
