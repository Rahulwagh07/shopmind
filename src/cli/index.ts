import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { runAgent } from "../agent/index.ts";

async function main() {
  console.log(chalk.bold.cyan("\nShop Agent REPL started!"));
  console.log(chalk.gray("Type 'exit' or 'quit' to close. Press Ctrl+C at any time.\n"));

  const argsQuestion = process.argv.slice(2).join(" ").trim();

  if (argsQuestion) {
    await processQuestion(argsQuestion);
    process.exit(0);
  }

  const rl = readline.createInterface({ input, output });

  while (true) {
    const question = await rl.question(chalk.bold.green("> Ask the agent: "));
    
    const trimmed = question.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    
    if (lower === "exit" || lower === "quit") {
      console.log(chalk.cyan("Goodbye!"));
      break;
    }

    if (lower === "help" || lower === "--help") {
      console.log(chalk.yellow("\nAvailable commands:"));
      console.log(chalk.yellow("  help, --help   Show this message"));
      console.log(chalk.yellow("  clear          Clear the terminal screen"));
      console.log(chalk.yellow("  exit, quit     Exit the REPL"));
      console.log(chalk.yellow("  (anything)     Ask the agent a question\n"));
      continue;
    }

    if (lower === "clear") {
      console.clear();
      continue;
    }

    await processQuestion(trimmed);
  }

  rl.close();
}

async function processQuestion(question: string) {
  try {
    const result = await runAgent(question);

    if (result.trace.length > 0) {
      console.log(chalk.bold.gray("\n--- Trace ---"));
      result.trace.forEach((step, index) => {
        console.log(chalk.gray(`${index + 1}. ${step.tool}`));
        console.log(chalk.dim(`   input:  ${JSON.stringify(step.input)}`));
        console.log(chalk.dim(`   output: ${JSON.stringify(step.output)}`));
      });
      console.log(chalk.bold.gray("-------------\n"));
    } else {
      console.log(); // Spacing
    }

    console.log(chalk.bold.blue("Answer: ") + result.answer + "\n");
  } catch (error) {
    console.log(chalk.red.bold("\nAgent failed: ") + (error instanceof Error ? error.message : String(error)) + "\n");
  }
}

main().catch((error) => {
  console.error(chalk.red("Fatal error: "), error);
  process.exit(1);
});
