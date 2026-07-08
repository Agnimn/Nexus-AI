import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/code/explain", requireAuth, async (req, res) => {
  const { code, language, context } = req.body as { code?: string; language?: string; context?: string };

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  try {
    const prompt = [
      context ? `Context: ${context}` : null,
      language ? `Language: ${language}` : null,
      `Code:\n\`\`\`${language ?? ""}\n${code}\n\`\`\``,
    ].filter(Boolean).join("\n");

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_completion_tokens: 3000,
      messages: [
        {
          role: "system",
          content: `You are an expert code reviewer and software architect. Provide a detailed analysis of the given code.
Respond ONLY in a JSON object matching this structure:
{
  "explanation": "clear paragraph-by-paragraph breakdown",
  "summary": "1-sentence executive summary",
  "steps": ["step 1 explanation", "step 2 explanation", ...],
  "timeComplexity": "O(...) explanation",
  "spaceComplexity": "O(...) explanation",
  "bestPractices": ["best practice 1", "best practice 2", ...],
  "optimizations": ["optimization suggestion 1", "optimization suggestion 2", ...],
  "securityRisks": ["security risk 1", "security risk 2", ...],
  "refactoredCode": "fully refactored, cleaner, optimized code block",
  "rating": 9
}
Ensure the rating is an integer between 1 and 10. Make explanations clear and pedagogical.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content) as {
      explanation?: string;
      summary?: string;
      steps?: string[];
      timeComplexity?: string;
      spaceComplexity?: string;
      bestPractices?: string[];
      optimizations?: string[];
      securityRisks?: string[];
      refactoredCode?: string;
      rating?: number;
    };

    res.json({
      explanation: result.explanation ?? "Unable to generate explanation.",
      summary: result.summary ?? "Code snippet analysis.",
      steps: result.steps ?? [],
      timeComplexity: result.timeComplexity ?? "N/A",
      spaceComplexity: result.spaceComplexity ?? "N/A",
      bestPractices: result.bestPractices ?? [],
      optimizations: result.optimizations ?? [],
      securityRisks: result.securityRisks ?? [],
      refactoredCode: result.refactoredCode ?? code,
      rating: result.rating ?? 8,
    });
  } catch (err) {
    req.log.error({ err }, "Code explain failed");
    res.status(500).json({ error: "Failed to explain code" });
  }
});

export default router;
