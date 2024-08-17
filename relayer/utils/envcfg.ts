import * as fs from "fs";
import * as path from "path";

const envFilePath = path.resolve(__dirname, "../.env");

function updateEnvVariable(key: string, value: string): void {
  const envFileContent = fs.readFileSync(envFilePath, "utf-8");
  const lines = envFileContent.split("\n");

  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updatedLines.find((line) => line.startsWith(`${key}=`))) {
    updatedLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFilePath, updatedLines.join("\n"));
  console.log(`Updated ${key} in .env file to: ${value}`);
}

export default updateEnvVariable;