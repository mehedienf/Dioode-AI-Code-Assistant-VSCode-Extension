import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

function getGeminiApiKey(context: vscode.ExtensionContext): string | undefined {
  // 1. Check process.env
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // 2. Check .env file in extension directory
  const envPath = path.join(context.extensionPath, ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...val] = trimmed.split("=");
          if (key.trim() === "GEMINI_API_KEY") {
            return val
              .join("=")
              .trim()
              .replace(/^["'](.*)["']$/, "$1");
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Check VS Code settings configuration
  const configKey = vscode.workspace
    .getConfiguration("dioode")
    .get<string>("apiKey");
  if (configKey) {
    return configKey;
  }

  return undefined;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "dioode" is now active!');

  // ask to dioode
  let askDioode = vscode.commands.registerCommand(
    "dioode.askDioode",
    async () => {
      // receive current text editor window
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showErrorMessage("No active editor found!");
        return;
      }

      // Receive selected text
      const selectedText = editor.document.getText(editor.selection);

      if (!selectedText) {
        vscode.window.showWarningMessage("Please select some code first!");
        return;
      }

      // receive user input
      const userPrompt = await vscode.window.showInputBox({
        prompt: "What do you want to do with the selected code?",
        placeHolder: "e.g., Explain this, Refactor this, Find bugs",
      });

      if (userPrompt) {
        // progress bar
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Diode is thinking...",
            cancellable: false,
          },
          async (progress) => {
            try {
              // user prompt create
              const fullPrompt = `${userPrompt}\n\nHere is the code:\n\`\`\`\n${selectedText}\n\`\`\``;

              const apiKey = getGeminiApiKey(context);
              if (!apiKey) {
                vscode.window.showErrorMessage(
                  "Diode AI Error: GEMINI_API_KEY is not configured! Please set it in .env or settings.",
                );
                return;
              }

              // gmeini api call
              const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
                {
                  contents: [{ parts: [{ text: fullPrompt }] }],
                },
              );

              // collect response text
              const replyText =
                response.data.candidates[0].content.parts[0].text;

              // reply on a new output channel
              const outputChannel =
                vscode.window.createOutputChannel("Diode AI Output");
              outputChannel.show(true); // open with focus
              outputChannel.appendLine("=== Diode Response ===\n");
              outputChannel.appendLine(replyText);
            } catch (error: any) {
              // আসল এরর মেসেজটি বের করা
              const errorMessage =
                error.response?.data?.error?.message ||
                error.message ||
                "Unknown error";

              // আসল এরর মেসেজ নোটিফিকেশনে দেখানো
              vscode.window.showErrorMessage(`Diode AI Error: ${errorMessage}`);
              console.error("Full Error Object:", error);
            }
          },
        );
      } // if block end
    },
  );

  context.subscriptions.push(askDioode);
}

export function deactivate() {}
