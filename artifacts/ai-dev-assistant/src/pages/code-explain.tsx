import React, { useState } from "react";
import { useExplainCode } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Code,
  Bot,
  Sparkles,
  Loader2,
  ArrowRight,
  Copy,
  Check,
  Download,
  Award,
  Zap,
  Shield,
  Layers,
  FileText
} from "lucide-react";

const LANGUAGES = [
  "javascript", "typescript", "python", "go", "rust", "java", "c++", "ruby", "php", "c#"
];

export default function CodeExplain() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [copied, setCopied] = useState(false);
  const explainCode = useExplainCode();

  const handleExplain = () => {
    if (!code.trim()) return;
    explainCode.mutate({ data: { code, language } });
  };

  const getMarkdownContent = (data: any) => {
    return `# AI Code Explanation Report
Generated on: ${new Date().toLocaleDateString()}
Code Quality Rating: ${data.rating ?? 8}/10

## 📝 Executive Summary
${data.summary}

## 🔍 Detailed Explanation
${data.explanation}

## ⚙️ Execution Complexity
- **Time Complexity:** ${data.timeComplexity}
- **Space Complexity:** ${data.spaceComplexity}

## 📈 Step-by-Step Breakdown
${(data.steps ?? []).map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")}

## 🚨 Security & Risk Analysis
${(data.securityRisks ?? []).map((risk: string) => `- [!] ${risk}`).join("\n")}

## ⚡ Recommended Optimizations
${(data.optimizations ?? []).map((opt: string) => `- ${opt}`).join("\n")}

## 🛠️ Best Practices Followed
${(data.bestPractices ?? []).map((bp: string) => `- ${bp}`).join("\n")}

## 💻 Refactored Code Suggestion
\`\`\`${language}
${data.refactoredCode}
\`\`\`
`;
  };

  const handleCopy = () => {
    if (!explainCode.data) return;
    const content = getMarkdownContent(explainCode.data);
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: "Copied to Clipboard",
      description: "Full markdown analysis copied successfully.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!explainCode.data) return;
    const md = getMarkdownContent(explainCode.data);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-explanation-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const getRatingBadge = (rating: number) => {
    if (rating >= 8) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-sm font-bold flex items-center gap-1"><Award className="h-4 w-4" /> Rating: {rating}/10</Badge>;
    if (rating >= 5) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-sm font-bold flex items-center gap-1"><Award className="h-4 w-4" /> Rating: {rating}/10</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-sm font-bold flex items-center gap-1"><Award className="h-4 w-4" /> Rating: {rating}/10</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Explain Code</h1>
          <p className="text-muted-foreground">Dissect logical execution paths, analyze runtime complexity, and suggest refactored outputs.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor Card */}
          <Card className="bg-card/50 backdrop-blur-sm border-muted flex flex-col h-[480px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Code className="h-4 w-4 text-primary" /> Source Code
                </CardTitle>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[150px] bg-card border-muted">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-muted text-foreground">
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
              <Textarea 
                placeholder="Paste code snippet to analyze..." 
                className="flex-1 font-mono text-sm resize-none bg-muted/20 border-muted p-4 focus:ring-1 focus:ring-primary rounded-lg overflow-y-auto"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button 
                className="w-full h-12 text-md font-semibold bg-primary hover:bg-primary/95 text-primary-foreground" 
                onClick={handleExplain}
                disabled={!code.trim() || explainCode.isPending}
              >
                {explainCode.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing Logic...</>
                ) : (
                  <><Sparkles className="mr-2 h-5 w-5" /> Analyze Snippet</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Report Card */}
          <Card className="bg-card/50 backdrop-blur-sm border-muted flex flex-col h-[480px]">
            <CardHeader className="pb-3 border-b border-muted">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-primary" /> Analysis Report
                </CardTitle>
                {explainCode.data && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Markdown" className="h-8 w-8 hover:bg-muted">
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleExportMarkdown} title="Download Markdown" className="h-8 w-8 hover:bg-muted">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handlePrintPDF} title="Print Report" className="h-8 w-8 hover:bg-muted">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
              {explainCode.isPending ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse"></div>
                    <Bot className="h-12 w-12 text-primary relative z-10 animate-bounce" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-widest text-primary animate-pulse">Decompiling Execution Tree...</p>
                </div>
              ) : explainCode.isSuccess && explainCode.data ? (
                <div className="space-y-6">
                  {/* Rating Header */}
                  <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/30">
                    <span className="text-xs text-muted-foreground font-mono uppercase">AI Verdict</span>
                    {getRatingBadge(explainCode.data.rating)}
                  </div>

                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider font-mono">Summary</h3>
                    <p className="text-sm font-medium leading-relaxed text-foreground italic border-l-2 border-primary pl-3 bg-muted/10 p-3 rounded-r-lg">
                      "{explainCode.data.summary}"
                    </p>
                  </div>

                  {/* Complexities */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/20 p-3 rounded-lg border border-border/30">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Time Complexity</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono">{explainCode.data.timeComplexity}</Badge>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-lg border border-border/30">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Space Complexity</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono">{explainCode.data.spaceComplexity}</Badge>
                    </div>
                  </div>

                  {/* Detailed Explanation */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider font-mono">Detailed Analysis</h3>
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-4 rounded-lg border border-muted">
                      {explainCode.data.explanation}
                    </div>
                  </div>

                  {/* Step by Step list */}
                  {explainCode.data.steps && explainCode.data.steps.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider font-mono">Execution Steps</h3>
                      <div className="space-y-2">
                        {explainCode.data.steps.map((step: string, i: number) => (
                          <div key={i} className="flex gap-3 text-sm p-3 rounded-lg bg-muted/20 border border-muted">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            <span className="text-foreground">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Security Risks */}
                  {explainCode.data.securityRisks && explainCode.data.securityRisks.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider font-mono flex items-center gap-1"><Shield className="h-4 w-4 text-red-400" /> Security Risks</h3>
                      <div className="space-y-2">
                        {explainCode.data.securityRisks.map((risk: string, i: number) => (
                          <div key={i} className="text-xs text-red-400 p-2.5 rounded bg-red-950/20 border border-red-900/30">
                            🚨 {risk}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refactored Code */}
                  {explainCode.data.refactoredCode && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider font-mono flex items-center gap-1.5"><Layers className="h-4 w-4 text-primary" /> Refactored Suggestion</h3>
                      <pre className="p-4 rounded-lg bg-muted/40 font-mono text-xs overflow-x-auto border border-muted text-foreground max-h-[180px]">
                        <code>{explainCode.data.refactoredCode}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8 border border-dashed rounded-lg border-muted">
                  <Bot className="h-12 w-12 mb-4 opacity-20 text-primary" />
                  <h4 className="font-semibold text-foreground mb-1">No Analysis Report</h4>
                  <p className="text-sm">Paste your source code in the editor block and click analyze to output the full review log here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
