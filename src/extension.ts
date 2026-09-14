import axios from "axios";
import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";

// .env file load
dotenv.config({ path: path.join(__dirname, "../.env") });

// Gemini api key from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
      const selection = editor.selection;
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
            title: "Dioode is thinking...",
            cancellable: false,
          },
          async (progress) => {
            try {
              // user prompt create
              const fullPrompt = `${userPrompt}\n(Note: Keep the answer concise and brief.)\n\nHere is the code:\n\`\`\`\n${selectedText}\n\`\`\``;

              // gmeini api call
              const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                  contents: [{ parts: [{ text: fullPrompt }] }],
                  generationConfig: {
                    maxOutputTokens: 1000,
                  },
                },
              );

              // collect response text
              const replyText =
                response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

              if (!replyText) {
                const finishReason =
                  response.data?.candidates?.[0]?.finishReason ||
                  "No response received";
                vscode.window.showWarningMessage(
                  `Dioode AI: No text returned! Reason: ${finishReason}`,
                );
                console.log("Full Gemini Response:", response.data);
                return;
              }

              // quick pick menu
              const action = await vscode.window.showQuickPick(
                ["View in Output Channel", "Replace Selected Code in Editor"],
                { placeHolder: "How do you want to handle the response?" },
              );

              if (action === "Replace Selected Code in Editor") {
                // edit on editor
				editor.edit((editBuilder) => {
                  editBuilder.replace(selection, replyText);
                });
              } else {
                // reply on a new output channel
                const outputChannel =
                  vscode.window.createOutputChannel("Dioode AI Output");
                outputChannel.show(true); // open with focus
                outputChannel.appendLine("=== Dioode Response ===\n");
                outputChannel.appendLine(replyText);
              }
            } catch (error: any) {
              // আসল এরর মেসেজটি বের করা
              const errorMessage =
                error.response?.data?.error?.message ||
                error.message ||
                "Unknown error";

              // আসল এরর মেসেজ নোটিফিকেশনে দেখানো
              vscode.window.showErrorMessage(
                `Dioode AI Error: ${errorMessage}`,
              );
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
